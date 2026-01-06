const petService = require("../services/pet.service");
const uploadService = require("../services/upload.service");
const auditUtil = require("../utils/audit.util");
const ResponseUtil = require("../utils/response.util");

class PetController {
  // ==================== PET MANAGEMENT ====================

  async getAllPets(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { is_active, species_id } = req.query;

      const pets = await petService.getAllPets(userId, { is_active, species_id });

      return ResponseUtil.success(res, { pets }, "Pets retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async getPet(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id } = req.params;

      const pet = await petService.getPetById(pet_id, userId);

      return ResponseUtil.success(res, pet, "Pet retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async createPet(req, res, next) {
    try {
      const userId = req.user.user_id;
      const petData = req.body;

      const pet = await petService.createPet(userId, petData);

      await auditUtil.log({
        user_id: userId,
        action: "create",
        entity_type: "pet",
        entity_id: pet.pet_id,
        new_value: pet,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, pet, "Pet created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  async updatePet(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id } = req.params;
      const updateData = req.body;

      const oldPet = await petService.getPetById(pet_id, userId);
      const pet = await petService.updatePet(pet_id, userId, updateData);

      await auditUtil.log({
        user_id: userId,
        action: "update",
        entity_type: "pet",
        entity_id: pet_id,
        old_value: oldPet,
        new_value: pet,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, pet, "Pet updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async uploadPetPhoto(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id } = req.params;

      if (!req.file) {
        return ResponseUtil.error(res, "No file uploaded", 400);
      }

      const photoUrl = await uploadService.uploadPetPhoto(req.file, pet_id);
      const result = await petService.updatePetPhoto(pet_id, userId, photoUrl);

      await auditUtil.log({
        user_id: userId,
        action: "update",
        entity_type: "pet",
        entity_id: pet_id,
        changes_summary: "Pet photo updated",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, result, "Pet photo uploaded successfully");
    } catch (error) {
      next(error);
    }
  }

  async deletePet(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id } = req.params;

      await petService.deletePet(pet_id, userId);

      await auditUtil.log({
        user_id: userId,
        action: "delete",
        entity_type: "pet",
        entity_id: pet_id,
        changes_summary: "Pet deactivated",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, null, "Pet deactivated successfully");
    } catch (error) {
      next(error);
    }
  }

  async markPetDeceased(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id } = req.params;
      const { deceased_date } = req.body;

      const pet = await petService.markPetDeceased(pet_id, userId, deceased_date);

      await auditUtil.log({
        user_id: userId,
        action: "update",
        entity_type: "pet",
        entity_id: pet_id,
        changes_summary: "Pet marked as deceased",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, pet, "Pet marked as deceased");
    } catch (error) {
      next(error);
    }
  }

  // ==================== HEALTH RECORDS ====================

  async getHealthRecords(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id } = req.params;
      const { record_type, start_date, end_date } = req.query;

      const records = await petService.getHealthRecords(pet_id, userId, {
        record_type,
        start_date,
        end_date,
      });

      return ResponseUtil.success(res, { records }, "Health records retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async getHealthRecord(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id, record_id } = req.params;

      const record = await petService.getHealthRecordById(record_id, pet_id, userId);

      return ResponseUtil.success(res, record, "Health record retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async createHealthRecord(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id } = req.params;
      const recordData = req.body;

      const record = await petService.createHealthRecord(pet_id, userId, recordData);

      await auditUtil.log({
        user_id: userId,
        action: "create",
        entity_type: "health_record",
        entity_id: record.record_id,
        new_value: record,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, record, "Health record created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  async updateHealthRecord(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id, record_id } = req.params;
      const updateData = req.body;

      const oldRecord = await petService.getHealthRecordById(record_id, pet_id, userId);
      const record = await petService.updateHealthRecord(record_id, pet_id, userId, updateData);

      await auditUtil.log({
        user_id: userId,
        action: "update",
        entity_type: "health_record",
        entity_id: record_id,
        old_value: oldRecord,
        new_value: record,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, record, "Health record updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async deleteHealthRecord(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id, record_id } = req.params;

      await petService.deleteHealthRecord(record_id, pet_id, userId);

      await auditUtil.log({
        user_id: userId,
        action: "delete",
        entity_type: "health_record",
        entity_id: record_id,
        changes_summary: "Health record deleted",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, null, "Health record deleted successfully");
    } catch (error) {
      next(error);
    }
  }

  // ==================== VACCINATIONS ====================

  async getVaccinations(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id } = req.params;
      const { upcoming } = req.query;

      const vaccinations = await petService.getVaccinations(pet_id, userId, { upcoming });

      return ResponseUtil.success(res, { vaccinations }, "Vaccinations retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async createVaccination(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id } = req.params;
      const vaccinationData = req.body;

      const vaccination = await petService.createVaccination(pet_id, userId, vaccinationData);

      await auditUtil.log({
        user_id: userId,
        action: "create",
        entity_type: "vaccination",
        entity_id: vaccination.vaccination_id,
        new_value: vaccination,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, vaccination, "Vaccination record created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  async updateVaccination(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id, vaccination_id } = req.params;
      const updateData = req.body;

      const vaccination = await petService.updateVaccination(
        vaccination_id,
        pet_id,
        userId,
        updateData
      );

      await auditUtil.log({
        user_id: userId,
        action: "update",
        entity_type: "vaccination",
        entity_id: vaccination_id,
        new_value: vaccination,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, vaccination, "Vaccination updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async deleteVaccination(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id, vaccination_id } = req.params;

      await petService.deleteVaccination(vaccination_id, pet_id, userId);

      await auditUtil.log({
        user_id: userId,
        action: "delete",
        entity_type: "vaccination",
        entity_id: vaccination_id,
        changes_summary: "Vaccination record deleted",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, null, "Vaccination deleted successfully");
    } catch (error) {
      next(error);
    }
  }

  // ==================== MEDICATIONS ====================

  async getMedications(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id } = req.params;
      const { is_active } = req.query;

      const medications = await petService.getMedications(pet_id, userId, { is_active });

      return ResponseUtil.success(res, { medications }, "Medications retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async createMedication(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id } = req.params;
      const medicationData = req.body;

      const medication = await petService.createMedication(pet_id, userId, medicationData);

      await auditUtil.log({
        user_id: userId,
        action: "create",
        entity_type: "medication",
        entity_id: medication.medication_id,
        new_value: medication,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, medication, "Medication created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  async updateMedication(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id, medication_id } = req.params;
      const updateData = req.body;

      const medication = await petService.updateMedication(
        medication_id,
        pet_id,
        userId,
        updateData
      );

      await auditUtil.log({
        user_id: userId,
        action: "update",
        entity_type: "medication",
        entity_id: medication_id,
        new_value: medication,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, medication, "Medication updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async deleteMedication(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id, medication_id } = req.params;

      await petService.deleteMedication(medication_id, pet_id, userId);

      await auditUtil.log({
        user_id: userId,
        action: "delete",
        entity_type: "medication",
        entity_id: medication_id,
        changes_summary: "Medication deactivated",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, null, "Medication deactivated successfully");
    } catch (error) {
      next(error);
    }
  }

  // ==================== PET INSURANCE ====================

  async getInsurance(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id } = req.params;

      const insurance = await petService.getInsurance(pet_id, userId);

      return ResponseUtil.success(res, { insurance }, "Insurance records retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async createInsurance(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id } = req.params;
      const insuranceData = req.body;

      const insurance = await petService.createInsurance(pet_id, userId, insuranceData);

      await auditUtil.log({
        user_id: userId,
        action: "create",
        entity_type: "pet_insurance",
        entity_id: insurance.insurance_id,
        new_value: insurance,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, insurance, "Insurance record created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  async updateInsurance(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id, insurance_id } = req.params;
      const updateData = req.body;

      const insurance = await petService.updateInsurance(
        insurance_id,
        pet_id,
        userId,
        updateData
      );

      await auditUtil.log({
        user_id: userId,
        action: "update",
        entity_type: "pet_insurance",
        entity_id: insurance_id,
        new_value: insurance,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, insurance, "Insurance updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async deleteInsurance(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id, insurance_id } = req.params;

      await petService.deleteInsurance(insurance_id, pet_id, userId);

      await auditUtil.log({
        user_id: userId,
        action: "delete",
        entity_type: "pet_insurance",
        entity_id: insurance_id,
        changes_summary: "Insurance record deactivated",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, null, "Insurance deactivated successfully");
    } catch (error) {
      next(error);
    }
  }

  // ==================== GROWTH TRACKING ====================

  async getGrowthTracking(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id } = req.params;
      const { start_date, end_date } = req.query;

      const records = await petService.getGrowthTracking(pet_id, userId, {
        start_date,
        end_date,
      });

      return ResponseUtil.success(res, { records }, "Growth records retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async createGrowthRecord(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id } = req.params;
      const recordData = req.body;

      const record = await petService.createGrowthRecord(pet_id, userId, recordData);

      await auditUtil.log({
        user_id: userId,
        action: "create",
        entity_type: "growth_tracking",
        entity_id: record.tracking_id,
        new_value: record,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, record, "Growth record created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  async updateGrowthRecord(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id, tracking_id } = req.params;
      const updateData = req.body;

      const record = await petService.updateGrowthRecord(
        tracking_id,
        pet_id,
        userId,
        updateData
      );

      await auditUtil.log({
        user_id: userId,
        action: "update",
        entity_type: "growth_tracking",
        entity_id: tracking_id,
        new_value: record,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, record, "Growth record updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async deleteGrowthRecord(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { pet_id, tracking_id } = req.params;

      await petService.deleteGrowthRecord(tracking_id, pet_id, userId);

      await auditUtil.log({
        user_id: userId,
        action: "delete",
        entity_type: "growth_tracking",
        entity_id: tracking_id,
        changes_summary: "Growth record deleted",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return ResponseUtil.success(res, null, "Growth record deleted successfully");
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PetController();