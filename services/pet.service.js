const { pool } = require("../config/database");
const { AppError } = require("../utils/response.util");

class PetService {
  // ==================== HELPER METHODS ====================

  async verifyPetOwnership(petId, userId) {
    const query = "SELECT owner_id FROM pets WHERE pet_id = $1 AND is_active = true";
    const result = await pool.query(query, [petId]);

    if (result.rows.length === 0) {
      throw new AppError("Pet not found", 404, "PET_NOT_FOUND");
    }

    if (result.rows[0].owner_id !== userId) {
      throw new AppError("Unauthorized access to pet", 403, "UNAUTHORIZED_PET_ACCESS");
    }

    return true;
  }

  async calculateLifeStage(speciesId, dateOfBirth) {
    const ageInMonths = this.getAgeInMonths(dateOfBirth);

    const query = `
      SELECT life_stage_id
      FROM life_stages_ref
      WHERE species_id = $1
        AND (min_age_months IS NULL OR min_age_months <= $2)
        AND (max_age_months IS NULL OR max_age_months >= $2)
        AND is_active = true
      LIMIT 1
    `;

    const result = await pool.query(query, [speciesId, ageInMonths]);

    if (result.rows.length === 0) {
      // Default to first life stage for species
      const defaultQuery = `
        SELECT life_stage_id
        FROM life_stages_ref
        WHERE species_id = $1 AND is_active = true
        ORDER BY min_age_months ASC NULLS FIRST
        LIMIT 1
      `;
      const defaultResult = await pool.query(defaultQuery, [speciesId]);
      return defaultResult.rows[0]?.life_stage_id;
    }

    return result.rows[0].life_stage_id;
  }

  async updateAllPetLifeStages() {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Find all pets whose calculated life_stage (based on age) is different from their current life_stage
      // We join pets with life_stages_ref twice:
      // - current_ls: the one currently assigned to the pet
      // - target_ls: the correct one for their current age
      
      const findUpdatesQuery = `
        WITH PetAges AS (
            SELECT 
                p.pet_id,
                p.species_id,
                p.life_stage_id as current_stage_id,
                EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_of_birth)) * 12 + 
                EXTRACT(MONTH FROM AGE(CURRENT_DATE, p.date_of_birth)) as age_months
            FROM pets p
            WHERE p.is_active = true
        ),
        TargetStages AS (
            SELECT 
                pa.pet_id,
                pa.current_stage_id,
                ls.life_stage_id as new_stage_id
            FROM PetAges pa
            JOIN life_stages_ref ls ON 
                ls.species_id = pa.species_id
                AND ls.is_active = true
                AND (ls.min_age_months IS NULL OR ls.min_age_months <= pa.age_months)
                AND (ls.max_age_months IS NULL OR ls.max_age_months > pa.age_months)
            WHERE ls.life_stage_id != pa.current_stage_id
        )
        SELECT pet_id, new_stage_id FROM TargetStages;
      `;

      const petsToUpdate = await client.query(findUpdatesQuery);

      if (petsToUpdate.rows.length === 0) {
        await client.query("COMMIT");
        return { updated_count: 0 };
      }

      // 2. Batch update
      // For simplicity/safety with small-medium datasets, we can iterate or use a massive CASE statement. 
      // For thousands of pets, iterating int array is fine in node, or a more complex single query.
      // Let's do a single update with FROM VALUES for performance.
      
      const updates = petsToUpdate.rows;
      
      // Construct VALUES list: (pet_id, new_stage_id), ...
      const valuesList = updates.map((_, i) => `($${i * 2 + 1}::integer, $${i * 2 + 2}::integer)`).join(',');
      const queryParams = updates.flatMap(u => [u.pet_id, u.new_stage_id]);

      const updateQuery = `
        UPDATE pets AS p
        SET 
            life_stage_id = v.new_stage_id,
            updated_at = NOW()
        FROM (VALUES ${valuesList}) AS v(pet_id, new_stage_id)
        WHERE p.pet_id = v.pet_id
      `;

      await client.query(updateQuery, queryParams);
      await client.query("COMMIT");

      return { updated_count: updates.length };

    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  getAgeInMonths(dateOfBirth) {
    const today = new Date();
    const dob = new Date(dateOfBirth);
    let months = (today.getFullYear() - dob.getFullYear()) * 12;
    months -= dob.getMonth();
    months += today.getMonth();
    return months <= 0 ? 0 : months;
  }

  // ==================== PET MANAGEMENT ====================

  async getAllPets(userId, filters = {}) {
    let query = `
      SELECT 
        p.*,
        s.species_name,
        ls.life_stage_name,
        g.gender_name,
        EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_of_birth)) AS age_years,
        EXTRACT(MONTH FROM AGE(CURRENT_DATE, p.date_of_birth)) AS age_months
      FROM pets p
      LEFT JOIN species_ref s ON p.species_id = s.species_id
      LEFT JOIN life_stages_ref ls ON p.life_stage_id = ls.life_stage_id
      LEFT JOIN gender_ref g ON p.gender_id = g.gender_id
      WHERE p.owner_id = $1
    `;

    const params = [userId];
    let paramCount = 2;

    if (filters.is_active !== undefined) {
      query += ` AND p.is_active = $${paramCount}`;
      params.push(filters.is_active === 'true');
      paramCount++;
    }

    if (filters.species_id) {
      query += ` AND p.species_id = $${paramCount}`;
      params.push(filters.species_id);
      paramCount++;
    }

    query += ` ORDER BY p.created_at DESC`;

    const result = await pool.query(query, params);
    return result.rows;
  }

  async getPetById(petId, userId) {
    await this.verifyPetOwnership(petId, userId);

    const query = `
      SELECT 
        p.*,
        s.species_name,
        ls.life_stage_name,
        g.gender_name,
        EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_of_birth)) AS age_years,
        EXTRACT(MONTH FROM AGE(CURRENT_DATE, p.date_of_birth)) AS age_months
      FROM pets p
      LEFT JOIN species_ref s ON p.species_id = s.species_id
      LEFT JOIN life_stages_ref ls ON p.life_stage_id = ls.life_stage_id
      LEFT JOIN gender_ref g ON p.gender_id = g.gender_id
      WHERE p.pet_id = $1
    `;

    const result = await pool.query(query, [petId]);
    return result.rows[0];
  }

  async createPet(userId, petData) {
    const {
      name,
      species_id,
      breed,
      gender_id,
      date_of_birth,
      weight,
      color,
      microchip_id,
      medical_conditions,
      behavioral_notes,
    } = petData;

    // Calculate life stage based on age
    const lifeStageId = await this.calculateLifeStage(species_id, date_of_birth);

    // Check microchip uniqueness if provided
    if (microchip_id) {
      const chipCheck = await pool.query(
        "SELECT pet_id FROM pets WHERE microchip_id = $1",
        [microchip_id]
      );
      if (chipCheck.rows.length > 0) {
        throw new AppError("Microchip ID already exists", 409, "MICROCHIP_EXISTS");
      }
    }

    const query = `
      INSERT INTO pets (
        owner_id, name, species_id, life_stage_id, breed, gender_id,
        date_of_birth, weight, color, microchip_id, medical_conditions, behavioral_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      userId,
      name,
      species_id,
      lifeStageId,
      breed || null,
      gender_id || null,
      date_of_birth,
      weight || null,
      color || null,
      microchip_id || null,
      medical_conditions || null,
      behavioral_notes || null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async updatePet(petId, userId, updateData) {
    await this.verifyPetOwnership(petId, userId);

    const updates = [];
    const values = [];
    let paramCount = 1;

    const fields = [
      "name",
      "breed",
      "gender_id",
      "weight",
      "color",
      "microchip_id",
      "medical_conditions",
      "behavioral_notes",
    ];

    fields.forEach((field) => {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        values.push(updateData[field]);
        paramCount++;
      }
    });

    // Recalculate life stage if date_of_birth changed
    if (updateData.date_of_birth) {
      const pet = await this.getPetById(petId, userId);
      const newLifeStageId = await this.calculateLifeStage(
        pet.species_id,
        updateData.date_of_birth
      );
      updates.push(`date_of_birth = $${paramCount}`);
      values.push(updateData.date_of_birth);
      paramCount++;
      updates.push(`life_stage_id = $${paramCount}`);
      values.push(newLifeStageId);
      paramCount++;
    }

    if (updates.length === 0) {
      throw new AppError("No fields to update", 400, "NO_UPDATES");
    }

    updates.push(`updated_at = NOW()`);
    values.push(petId);

    const query = `
      UPDATE pets 
      SET ${updates.join(", ")}
      WHERE pet_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async updatePetPhoto(petId, userId, photoUrl) {
    await this.verifyPetOwnership(petId, userId);

    const query = `
      UPDATE pets 
      SET photo_url = $1, updated_at = NOW()
      WHERE pet_id = $2
      RETURNING photo_url
    `;

    const result = await pool.query(query, [photoUrl, petId]);
    return result.rows[0];
  }

  async deletePet(petId, userId) {
    await this.verifyPetOwnership(petId, userId);

    // Check for active subscriptions
    const subscriptionCheck = await pool.query(
      "SELECT subscription_id FROM subscriptions WHERE pet_id = $1 AND status = 'active'",
      [petId]
    );

    if (subscriptionCheck.rows.length > 0) {
      throw new AppError(
        "Cannot delete pet with active subscriptions",
        400,
        "PET_HAS_ACTIVE_SUBSCRIPTIONS"
      );
    }

    // Soft delete
    await pool.query("UPDATE pets SET is_active = false WHERE pet_id = $1", [petId]);
    return true;
  }

  async markPetDeceased(petId, userId, deceasedDate) {
    await this.verifyPetOwnership(petId, userId);

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Mark pet as deceased
      const updateResult = await client.query(
        `UPDATE pets 
         SET is_deceased = true, deceased_date = $1, is_active = false, updated_at = NOW()
         WHERE pet_id = $2
         RETURNING *`,
        [deceasedDate, petId]
      );

      // Cancel active subscriptions
      await client.query(
        `UPDATE subscriptions 
         SET status = 'cancelled', cancellation_date = NOW(),
             cancellation_reason = 'Pet deceased'
         WHERE pet_id = $1 AND status = 'active'`,
        [petId]
      );

      await client.query("COMMIT");

      return updateResult.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // ==================== HEALTH RECORDS ====================

  async getHealthRecords(petId, userId, filters = {}) {
    await this.verifyPetOwnership(petId, userId);

    let query = `
      SELECT h.*, u.full_name as created_by_name
      FROM health_records h
      LEFT JOIN users u ON h.created_by = u.user_id
      WHERE h.pet_id = $1
    `;

    const params = [petId];
    let paramCount = 2;

    if (filters.record_type) {
      query += ` AND h.record_type = $${paramCount}`;
      params.push(filters.record_type);
      paramCount++;
    }

    if (filters.start_date) {
      query += ` AND h.record_date >= $${paramCount}`;
      params.push(filters.start_date);
      paramCount++;
    }

    if (filters.end_date) {
      query += ` AND h.record_date <= $${paramCount}`;
      params.push(filters.end_date);
      paramCount++;
    }

    query += ` ORDER BY h.record_date DESC, h.created_at DESC`;

    const result = await pool.query(query, params);
    return result.rows;
  }

  async getHealthRecordById(recordId, petId, userId) {
    await this.verifyPetOwnership(petId, userId);

    const query = `
      SELECT h.*, u.full_name as created_by_name
      FROM health_records h
      LEFT JOIN users u ON h.created_by = u.user_id
      WHERE h.record_id = $1 AND h.pet_id = $2
    `;

    const result = await pool.query(query, [recordId, petId]);

    if (result.rows.length === 0) {
      throw new AppError("Health record not found", 404, "HEALTH_RECORD_NOT_FOUND");
    }

    return result.rows[0];
  }

  async createHealthRecord(petId, userId, recordData) {
    await this.verifyPetOwnership(petId, userId);

    const {
      record_type,
      title,
      description,
      record_date,
      provider_name,
      provider_contact,
      provider_address,
      document_urls,
      diagnosis,
      treatment_plan,
      notes,
      cost,
    } = recordData;

    const query = `
      INSERT INTO health_records (
        pet_id, record_type, title, description, record_date,
        provider_name, provider_contact, provider_address,
        document_urls, diagnosis, treatment_plan, notes, cost, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      petId,
      record_type,
      title,
      description || null,
      record_date,
      provider_name || null,
      provider_contact || null,
      provider_address || null,
      document_urls ? JSON.stringify(document_urls) : null,
      diagnosis || null,
      treatment_plan || null,
      notes || null,
      cost || null,
      userId,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async updateHealthRecord(recordId, petId, userId, updateData) {
    await this.verifyPetOwnership(petId, userId);
    await this.getHealthRecordById(recordId, petId, userId);

    const updates = [];
    const values = [];
    let paramCount = 1;

    const fields = [
      "record_type",
      "title",
      "description",
      "record_date",
      "provider_name",
      "provider_contact",
      "provider_address",
      "diagnosis",
      "treatment_plan",
      "notes",
      "cost",
    ];

    fields.forEach((field) => {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        values.push(updateData[field]);
        paramCount++;
      }
    });

    if (updateData.document_urls !== undefined) {
      updates.push(`document_urls = $${paramCount}`);
      values.push(JSON.stringify(updateData.document_urls));
      paramCount++;
    }

    if (updates.length === 0) {
      throw new AppError("No fields to update", 400, "NO_UPDATES");
    }

    updates.push(`updated_at = NOW()`);
    values.push(recordId);

    const query = `
      UPDATE health_records 
      SET ${updates.join(", ")}
      WHERE record_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async deleteHealthRecord(recordId, petId, userId) {
    await this.verifyPetOwnership(petId, userId);
    await this.getHealthRecordById(recordId, petId, userId);

    await pool.query("DELETE FROM health_records WHERE record_id = $1", [recordId]);
    return true;
  }

  // ==================== VACCINATIONS ====================

  async getVaccinations(petId, userId, filters = {}) {
    await this.verifyPetOwnership(petId, userId);

    let query = `
      SELECT *
      FROM vaccinations
      WHERE pet_id = $1
    `;

    const params = [petId];

    if (filters.upcoming === 'true') {
      query += ` AND next_due_date >= CURRENT_DATE AND is_completed = true`;
    }

    query += ` ORDER BY vaccination_date DESC, created_at DESC`;

    const result = await pool.query(query, params);
    return result.rows;
  }

  async createVaccination(petId, userId, vaccinationData) {
    await this.verifyPetOwnership(petId, userId);

    const {
      vaccine_name,
      vaccination_date,
      next_due_date,
      batch_number,
      provider,
      provider_contact,
      veterinarian_name,
      vaccination_site,
      adverse_reactions,
      certificate_url,
      notes,
    } = vaccinationData;

    const query = `
      INSERT INTO vaccinations (
        pet_id, vaccine_name, vaccination_date, next_due_date,
        batch_number, provider, provider_contact, veterinarian_name,
        vaccination_site, adverse_reactions, certificate_url, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      petId,
      vaccine_name,
      vaccination_date,
      next_due_date || null,
      batch_number || null,
      provider || null,
      provider_contact || null,
      veterinarian_name || null,
      vaccination_site || null,
      adverse_reactions || null,
      certificate_url || null,
      notes || null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async updateVaccination(vaccinationId, petId, userId, updateData) {
    await this.verifyPetOwnership(petId, userId);

    const updates = [];
    const values = [];
    let paramCount = 1;

    const fields = [
      "vaccine_name",
      "vaccination_date",
      "next_due_date",
      "batch_number",
      "provider",
      "provider_contact",
      "veterinarian_name",
      "vaccination_site",
      "adverse_reactions",
      "certificate_url",
      "is_completed",
      "notes",
    ];

    fields.forEach((field) => {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        values.push(updateData[field]);
        paramCount++;
      }
    });

    if (updates.length === 0) {
      throw new AppError("No fields to update", 400, "NO_UPDATES");
    }

    updates.push(`updated_at = NOW()`);
    values.push(vaccinationId);

    const query = `
      UPDATE vaccinations 
      SET ${updates.join(", ")}
      WHERE vaccination_id = $${paramCount} AND pet_id = $${paramCount + 1}
      RETURNING *
    `;

    values.push(petId);

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new AppError("Vaccination not found", 404, "VACCINATION_NOT_FOUND");
    }

    return result.rows[0];
  }

  async deleteVaccination(vaccinationId, petId, userId) {
    await this.verifyPetOwnership(petId, userId);

    const result = await pool.query(
      "DELETE FROM vaccinations WHERE vaccination_id = $1 AND pet_id = $2 RETURNING vaccination_id",
      [vaccinationId, petId]
    );

    if (result.rows.length === 0) {
      throw new AppError("Vaccination not found", 404, "VACCINATION_NOT_FOUND");
    }

    return true;
  }

  // ==================== MEDICATIONS ====================

  async getMedications(petId, userId, filters = {}) {
    await this.verifyPetOwnership(petId, userId);

    let query = `
      SELECT *
      FROM medications
      WHERE pet_id = $1
    `;

    const params = [petId];
    let paramCount = 2;

    if (filters.is_active !== undefined) {
      query += ` AND is_active = $${paramCount}`;
      params.push(filters.is_active === 'true');
      paramCount++;
    }

    query += ` ORDER BY start_date DESC, created_at DESC`;

    const result = await pool.query(query, params);
    return result.rows;
  }

  async createMedication(petId, userId, medicationData) {
    await this.verifyPetOwnership(petId, userId);

    const {
      medication_name,
      medication_type,
      dosage,
      frequency,
      route,
      start_date,
      end_date,
      prescribed_by,
      prescribed_for,
      pharmacy,
      refills_remaining,
      reminder_enabled,
      reminder_times,
      side_effects,
      instructions,
      notes,
    } = medicationData;

    const query = `
      INSERT INTO medications (
        pet_id, medication_name, medication_type, dosage, frequency, route,
        start_date, end_date, prescribed_by, prescribed_for, pharmacy,
        refills_remaining, reminder_enabled, reminder_times,
        side_effects, instructions, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `;

    const values = [
      petId,
      medication_name,
      medication_type || null,
      dosage,
      frequency,
      route || null,
      start_date,
      end_date || null,
      prescribed_by || null,
      prescribed_for || null,
      pharmacy || null,
      refills_remaining || 0,
      reminder_enabled !== undefined ? reminder_enabled : true,
      reminder_times ? JSON.stringify(reminder_times) : null,
      side_effects || null,
      instructions || null,
      notes || null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async updateMedication(medicationId, petId, userId, updateData) {
    await this.verifyPetOwnership(petId, userId);

    const updates = [];
    const values = [];
    let paramCount = 1;

    const fields = [
      "medication_name",
      "medication_type",
      "dosage",
      "frequency",
      "route",
      "start_date",
      "end_date",
      "prescribed_by",
      "prescribed_for",
      "pharmacy",
      "refills_remaining",
      "is_active",
      "reminder_enabled",
      "side_effects",
      "instructions",
      "notes",
    ];

    fields.forEach((field) => {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        values.push(updateData[field]);
        paramCount++;
      }
    });

    if (updateData.reminder_times !== undefined) {
      updates.push(`reminder_times = $${paramCount}`);
      values.push(JSON.stringify(updateData.reminder_times));
      paramCount++;
    }

    if (updates.length === 0) {
      throw new AppError("No fields to update", 400, "NO_UPDATES");
    }

    updates.push(`updated_at = NOW()`);
    values.push(medicationId, petId);

    const query = `
      UPDATE medications 
      SET ${updates.join(", ")}
      WHERE medication_id = $${paramCount} AND pet_id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new AppError("Medication not found", 404, "MEDICATION_NOT_FOUND");
    }

    return result.rows[0];
  }

  async deleteMedication(medicationId, petId, userId) {
    await this.verifyPetOwnership(petId, userId);

    const result = await pool.query(
      "UPDATE medications SET is_active = false WHERE medication_id = $1 AND pet_id = $2 RETURNING medication_id",
      [medicationId, petId]
    );

    if (result.rows.length === 0) {
      throw new AppError("Medication not found", 404, "MEDICATION_NOT_FOUND");
    }

    return true;
  }

  // ==================== PET INSURANCE ====================

  async getInsurance(petId, userId) {
    await this.verifyPetOwnership(petId, userId);

    const query = `
      SELECT *
      FROM pet_insurance
      WHERE pet_id = $1
      ORDER BY is_active DESC, end_date DESC
    `;

    const result = await pool.query(query, [petId]);
    return result.rows;
  }

  async createInsurance(petId, userId, insuranceData) {
    await this.verifyPetOwnership(petId, userId);

    const {
      insurer_name,
      policy_number,
      policy_holder_name,
      coverage_type,
      coverage_amount,
      deductible_amount,
      premium_amount,
      premium_frequency,
      start_date,
      end_date,
      renewal_date,
      claim_phone,
      claim_email,
      exclusions,
      documents_urls,
    } = insuranceData;

    // Check policy number uniqueness
    const policyCheck = await pool.query(
      "SELECT insurance_id FROM pet_insurance WHERE policy_number = $1",
      [policy_number]
    );

    if (policyCheck.rows.length > 0) {
      throw new AppError("Policy number already exists", 409, "POLICY_NUMBER_EXISTS");
    }

    const query = `
      INSERT INTO pet_insurance (
        pet_id, insurer_name, policy_number, policy_holder_name,
        coverage_type, coverage_amount, deductible_amount,
        premium_amount, premium_frequency, start_date, end_date,
        renewal_date, claim_phone, claim_email, exclusions, documents_urls
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;

    const values = [
      petId,
      insurer_name,
      policy_number,
      policy_holder_name || null,
      coverage_type || null,
      coverage_amount || null,
      deductible_amount || null,
      premium_amount || null,
      premium_frequency || null,
      start_date,
      end_date,
      renewal_date || null,
      claim_phone || null,
      claim_email || null,
      exclusions || null,
      documents_urls ? JSON.stringify(documents_urls) : null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async updateInsurance(insuranceId, petId, userId, updateData) {
    await this.verifyPetOwnership(petId, userId);

    const updates = [];
    const values = [];
    let paramCount = 1;

    const fields = [
      "insurer_name",
      "policy_holder_name",
      "coverage_type",
      "coverage_amount",
      "deductible_amount",
      "premium_amount",
      "premium_frequency",
      "start_date",
      "end_date",
      "renewal_date",
      "claim_phone",
      "claim_email",
      "exclusions",
      "is_active",
    ];

    fields.forEach((field) => {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        values.push(updateData[field]);
        paramCount++;
      }
    });

    if (updateData.documents_urls !== undefined) {
      updates.push(`documents_urls = $${paramCount}`);
      values.push(JSON.stringify(updateData.documents_urls));
      paramCount++;
    }

    if (updates.length === 0) {
      throw new AppError("No fields to update", 400, "NO_UPDATES");
    }

    updates.push(`updated_at = NOW()`);
    values.push(insuranceId, petId);

    const query = `
      UPDATE pet_insurance 
      SET ${updates.join(", ")}
      WHERE insurance_id = $${paramCount} AND pet_id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new AppError("Insurance not found", 404, "INSURANCE_NOT_FOUND");
    }

    return result.rows[0];
  }

  async deleteInsurance(insuranceId, petId, userId) {
    await this.verifyPetOwnership(petId, userId);

    const result = await pool.query(
      "UPDATE pet_insurance SET is_active = false WHERE insurance_id = $1 AND pet_id = $2 RETURNING insurance_id",
      [insuranceId, petId]
    );

    if (result.rows.length === 0) {
      throw new AppError("Insurance not found", 404, "INSURANCE_NOT_FOUND");
    }

    return true;
  }

  // ==================== GROWTH TRACKING ====================

  async getGrowthTracking(petId, userId, filters = {}) {
    await this.verifyPetOwnership(petId, userId);

    let query = `
      SELECT g.*, u.full_name as recorded_by_name
      FROM growth_tracking g
      LEFT JOIN users u ON g.recorded_by = u.user_id
      WHERE g.pet_id = $1
    `;

    const params = [petId];
    let paramCount = 2;

    if (filters.start_date) {
      query += ` AND g.measurement_date >= $${paramCount}`;
      params.push(filters.start_date);
      paramCount++;
    }

    if (filters.end_date) {
      query += ` AND g.measurement_date <= $${paramCount}`;
      params.push(filters.end_date);
      paramCount++;
    }

    query += ` ORDER BY g.measurement_date DESC`;

    const result = await pool.query(query, params);
    return result.rows;
  }

  async createGrowthRecord(petId, userId, recordData) {
    await this.verifyPetOwnership(petId, userId);

    const {
      measurement_date,
      weight,
      height,
      length,
      body_condition_score,
      notes,
      photo_url,
    } = recordData;

    const query = `
      INSERT INTO growth_tracking (
        pet_id, measurement_date, weight, height, length,
        body_condition_score, notes, recorded_by, photo_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      petId,
      measurement_date,
      weight || null,
      height || null,
      length || null,
      body_condition_score || null,
      notes || null,
      userId,
      photo_url || null,
    ];

    const result = await pool.query(query, values);

    // Also update pet's current weight
    if (weight) {
      await pool.query("UPDATE pets SET weight = $1 WHERE pet_id = $2", [weight, petId]);
    }

    return result.rows[0];
  }

  async updateGrowthRecord(trackingId, petId, userId, updateData) {
    await this.verifyPetOwnership(petId, userId);

    const updates = [];
    const values = [];
    let paramCount = 1;

    const fields = [
      "measurement_date",
      "weight",
      "height",
      "length",
      "body_condition_score",
      "notes",
      "photo_url",
    ];

    fields.forEach((field) => {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        values.push(updateData[field]);
        paramCount++;
      }
    });

    if (updates.length === 0) {
      throw new AppError("No fields to update", 400, "NO_UPDATES");
    }

    values.push(trackingId, petId);

    const query = `
      UPDATE growth_tracking 
      SET ${updates.join(", ")}
      WHERE tracking_id = $${paramCount} AND pet_id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new AppError("Growth record not found", 404, "GROWTH_RECORD_NOT_FOUND");
    }

    return result.rows[0];
  }

  async deleteGrowthRecord(trackingId, petId, userId) {
    await this.verifyPetOwnership(petId, userId);

    const result = await pool.query(
      "DELETE FROM growth_tracking WHERE tracking_id = $1 AND pet_id = $2 RETURNING tracking_id",
      [trackingId, petId]
    );

    if (result.rows.length === 0) {
      throw new AppError("Growth record not found", 404, "GROWTH_RECORD_NOT_FOUND");
    }

    return true;
  }
}

module.exports = new PetService();