const express = require('express');
const router = express.Router();
const petController = require('../../controllers/pet.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const { rateLimitMiddleware } = require('../../middlewares/rateLimit.middleware');
const { uploadPetPhoto } = require('../../middlewares/upload.middleware');

// Validation schemas
const {
  createPetSchema,
  updatePetSchema,
  createHealthRecordSchema,
  updateHealthRecordSchema,
  createVaccinationSchema,
  updateVaccinationSchema,
  createMedicationSchema,
  updateMedicationSchema,
  createInsuranceSchema,
  updateInsuranceSchema,
  createGrowthRecordSchema,
  updateGrowthRecordSchema,
  markPetDeceasedSchema
} = require('../../utils/validation.util');

// All routes require authentication
router.use(authMiddleware.authenticate);

// ==================== PET MANAGEMENT ====================
router.get('/', petController.getAllPets);
router.get('/:pet_id', petController.getPet);
router.post('/', rateLimitMiddleware(20, 60), validate(createPetSchema), petController.createPet);
router.put('/:pet_id', rateLimitMiddleware(30, 60), validate(updatePetSchema), petController.updatePet);
router.post('/:pet_id/upload-photo', rateLimitMiddleware(10, 60), uploadPetPhoto, petController.uploadPetPhoto);
router.delete('/:pet_id', rateLimitMiddleware(10, 60), petController.deletePet);
router.post('/:pet_id/mark-deceased', rateLimitMiddleware(5, 60), validate(markPetDeceasedSchema), petController.markPetDeceased);

// ==================== HEALTH RECORDS ====================
router.get('/:pet_id/health-records', petController.getHealthRecords);
router.get('/:pet_id/health-records/:record_id', petController.getHealthRecord);
router.post('/:pet_id/health-records', rateLimitMiddleware(30, 60), validate(createHealthRecordSchema), petController.createHealthRecord);
router.put('/:pet_id/health-records/:record_id', rateLimitMiddleware(30, 60), validate(updateHealthRecordSchema), petController.updateHealthRecord);
router.delete('/:pet_id/health-records/:record_id', rateLimitMiddleware(20, 60), petController.deleteHealthRecord);

// ==================== VACCINATIONS ====================
router.get('/:pet_id/vaccinations', petController.getVaccinations);
router.post('/:pet_id/vaccinations', rateLimitMiddleware(30, 60), validate(createVaccinationSchema), petController.createVaccination);
router.put('/:pet_id/vaccinations/:vaccination_id', rateLimitMiddleware(30, 60), validate(updateVaccinationSchema), petController.updateVaccination);
router.delete('/:pet_id/vaccinations/:vaccination_id', rateLimitMiddleware(20, 60), petController.deleteVaccination);

// ==================== MEDICATIONS ====================
router.get('/:pet_id/medications', petController.getMedications);
router.post('/:pet_id/medications', rateLimitMiddleware(30, 60), validate(createMedicationSchema), petController.createMedication);
router.put('/:pet_id/medications/:medication_id', rateLimitMiddleware(30, 60), validate(updateMedicationSchema), petController.updateMedication);
router.delete('/:pet_id/medications/:medication_id', rateLimitMiddleware(20, 60), petController.deleteMedication);

// ==================== PET INSURANCE ====================
router.get('/:pet_id/insurance', petController.getInsurance);
router.post('/:pet_id/insurance', rateLimitMiddleware(20, 60), validate(createInsuranceSchema), petController.createInsurance);
router.put('/:pet_id/insurance/:insurance_id', rateLimitMiddleware(30, 60), validate(updateInsuranceSchema), petController.updateInsurance);
router.delete('/:pet_id/insurance/:insurance_id', rateLimitMiddleware(20, 60), petController.deleteInsurance);

// ==================== GROWTH TRACKING ====================
router.get('/:pet_id/growth', petController.getGrowthTracking);
router.post('/:pet_id/growth', rateLimitMiddleware(30, 60), validate(createGrowthRecordSchema), petController.createGrowthRecord);
router.put('/:pet_id/growth/:tracking_id', rateLimitMiddleware(30, 60), validate(updateGrowthRecordSchema), petController.updateGrowthRecord);
router.delete('/:pet_id/growth/:tracking_id', rateLimitMiddleware(20, 60), petController.deleteGrowthRecord);

module.exports = router;