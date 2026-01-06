const Joi = require('joi');

const updateProfileSchema = Joi.object({
  full_name: Joi.string().min(2).max(255).trim(),
  email: Joi.string().email().lowercase().trim(),
  date_of_birth: Joi.date().max('now').iso(),
});

const createAddressSchema = Joi.object({
  label: Joi.string().valid('home', 'work', 'other').required(),
  address_line1: Joi.string().min(5).max(255).required(),
  address_line2: Joi.string().max(255).allow('', null),
  landmark: Joi.string().max(255).allow('', null),
  city: Joi.string().min(2).max(100).required(),
  state: Joi.string().min(2).max(100).required(),
  pincode: Joi.string().pattern(/^\d{6}$/).required(),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  is_default: Joi.boolean(),
});

const updateAddressSchema = Joi.object({
  label: Joi.string().valid('home', 'work', 'other'),
  address_line1: Joi.string().min(5).max(255),
  address_line2: Joi.string().max(255).allow('', null),
  landmark: Joi.string().max(255).allow('', null),
  city: Joi.string().min(2).max(100),
  state: Joi.string().min(2).max(100),
  pincode: Joi.string().pattern(/^\d{6}$/),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  is_default: Joi.boolean(),
});

const updatePreferencesSchema = Joi.object({
  language: Joi.string().valid('en', 'hi'),
  timezone: Joi.string(),
  notification_enabled: Joi.boolean(),
  sms_enabled: Joi.boolean(),
  email_enabled: Joi.boolean(),
  push_enabled: Joi.boolean(),
  whatsapp_enabled: Joi.boolean(),
  theme: Joi.string().valid('light', 'dark', 'auto'),
});

const updateNotificationPreferencesSchema = Joi.object({
  booking_confirmations: Joi.boolean(),
  booking_reminders: Joi.boolean(),
  health_reminders: Joi.boolean(),
  vaccination_reminders: Joi.boolean(),
  medication_reminders: Joi.boolean(),
  subscription_updates: Joi.boolean(),
  payment_alerts: Joi.boolean(),
  promotional: Joi.boolean(),
  community_events: Joi.boolean(),
  care_manager_updates: Joi.boolean(),
  sms_enabled: Joi.boolean(),
  email_enabled: Joi.boolean(),
  push_enabled: Joi.boolean(),
  whatsapp_enabled: Joi.boolean(),
  quiet_hours_start: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/),
  quiet_hours_end: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/),
});

const updatePhoneSchema = Joi.object({
  new_phone: Joi.string()
    .pattern(/^(\+91)?[6-9]\d{9}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must be a valid 10-digit Indian number, optionally starting with +91',
      'any.required': 'Phone number is required'
    }),
  otp: Joi.string().length(6).required(),
});

const updateEmailSchema = Joi.object({
  new_email: Joi.string().email().lowercase().required(),
  otp: Joi.string().length(6).required(),
});

// ==================== PET VALIDATION SCHEMAS ====================

const createPetSchema = Joi.object({
  name: Joi.string().min(1).max(100).required()
    .messages({
      'string.empty': 'Pet name is required',
      'string.max': 'Pet name must not exceed 100 characters'
    }),
  
  species_id: Joi.number().integer().positive().required()
    .messages({
      'number.base': 'Species ID must be a number',
      'any.required': 'Species is required'
    }),
  
  breed: Joi.string().max(100).allow(null, '').optional(),
  
  gender_id: Joi.number().integer().positive().allow(null).optional(),
  
  date_of_birth: Joi.date().max('now').required()
    .messages({
      'date.max': 'Date of birth cannot be in the future',
      'any.required': 'Date of birth is required'
    }),
  
  weight: Joi.number().positive().max(200).allow(null).optional()
    .messages({
      'number.positive': 'Weight must be positive',
      'number.max': 'Weight seems unrealistic'
    }),
  
  color: Joi.string().max(50).allow(null, '').optional(),
  
  microchip_id: Joi.string().max(50).allow(null, '').optional(),
  
  medical_conditions: Joi.string().allow(null, '').optional(),
  
  behavioral_notes: Joi.string().allow(null, '').optional()
});

const updatePetSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  breed: Joi.string().max(100).allow(null, '').optional(),
  gender_id: Joi.number().integer().positive().allow(null).optional(),
  date_of_birth: Joi.date().max('now').optional(),
  weight: Joi.number().positive().max(200).allow(null).optional(),
  color: Joi.string().max(50).allow(null, '').optional(),
  microchip_id: Joi.string().max(50).allow(null, '').optional(),
  medical_conditions: Joi.string().allow(null, '').optional(),
  behavioral_notes: Joi.string().allow(null, '').optional()
}).min(1);

const markPetDeceasedSchema = Joi.object({
  deceased_date: Joi.date().max('now').required()
    .messages({
      'date.max': 'Deceased date cannot be in the future',
      'any.required': 'Deceased date is required'
    })
});

// ==================== HEALTH RECORDS ====================

const createHealthRecordSchema = Joi.object({
  record_type: Joi.string()
    .valid('vaccination', 'vet_visit', 'medication', 'surgery', 'allergy', 'condition', 'test_result')
    .required()
    .messages({
      'any.only': 'Invalid record type',
      'any.required': 'Record type is required'
    }),
  
  title: Joi.string().min(1).max(255).required()
    .messages({
      'string.empty': 'Title is required',
      'string.max': 'Title must not exceed 255 characters'
    }),
  
  description: Joi.string().allow(null, '').optional(),
  
  record_date: Joi.date().max('now').required()
    .messages({
      'date.max': 'Record date cannot be in the future',
      'any.required': 'Record date is required'
    }),
  
  provider_name: Joi.string().max(255).allow(null, '').optional(),
  provider_contact: Joi.string().max(50).allow(null, '').optional(),
  provider_address: Joi.string().allow(null, '').optional(),
  document_urls: Joi.array().items(Joi.string().uri()).allow(null).optional(),
  diagnosis: Joi.string().allow(null, '').optional(),
  treatment_plan: Joi.string().allow(null, '').optional(),
  notes: Joi.string().allow(null, '').optional(),
  
  cost: Joi.number().positive().allow(null).optional()
    .messages({
      'number.positive': 'Cost must be positive'
    })
});

const updateHealthRecordSchema = Joi.object({
  record_type: Joi.string()
    .valid('vaccination', 'vet_visit', 'medication', 'surgery', 'allergy', 'condition', 'test_result')
    .optional(),
  title: Joi.string().min(1).max(255).optional(),
  description: Joi.string().allow(null, '').optional(),
  record_date: Joi.date().max('now').optional(),
  provider_name: Joi.string().max(255).allow(null, '').optional(),
  provider_contact: Joi.string().max(50).allow(null, '').optional(),
  provider_address: Joi.string().allow(null, '').optional(),
  document_urls: Joi.array().items(Joi.string().uri()).allow(null).optional(),
  diagnosis: Joi.string().allow(null, '').optional(),
  treatment_plan: Joi.string().allow(null, '').optional(),
  notes: Joi.string().allow(null, '').optional(),
  cost: Joi.number().positive().allow(null).optional()
}).min(1);

// ==================== VACCINATIONS ====================

const createVaccinationSchema = Joi.object({
  vaccine_name: Joi.string().min(1).max(255).required()
    .messages({
      'string.empty': 'Vaccine name is required',
      'string.max': 'Vaccine name must not exceed 255 characters'
    }),
  
  vaccination_date: Joi.date().max('now').required()
    .messages({
      'date.max': 'Vaccination date cannot be in the future',
      'any.required': 'Vaccination date is required'
    }),
  
  next_due_date: Joi.date().allow(null).optional(),
  batch_number: Joi.string().max(100).allow(null, '').optional(),
  provider: Joi.string().max(255).allow(null, '').optional(),
  provider_contact: Joi.string().max(50).allow(null, '').optional(),
  veterinarian_name: Joi.string().max(255).allow(null, '').optional(),
  vaccination_site: Joi.string().max(100).allow(null, '').optional(),
  adverse_reactions: Joi.string().allow(null, '').optional(),
  certificate_url: Joi.string().uri().allow(null, '').optional(),
  notes: Joi.string().allow(null, '').optional()
});

const updateVaccinationSchema = Joi.object({
  vaccine_name: Joi.string().min(1).max(255).optional(),
  vaccination_date: Joi.date().max('now').optional(),
  next_due_date: Joi.date().allow(null).optional(),
  batch_number: Joi.string().max(100).allow(null, '').optional(),
  provider: Joi.string().max(255).allow(null, '').optional(),
  provider_contact: Joi.string().max(50).allow(null, '').optional(),
  veterinarian_name: Joi.string().max(255).allow(null, '').optional(),
  vaccination_site: Joi.string().max(100).allow(null, '').optional(),
  adverse_reactions: Joi.string().allow(null, '').optional(),
  certificate_url: Joi.string().uri().allow(null, '').optional(),
  is_completed: Joi.boolean().optional(),
  notes: Joi.string().allow(null, '').optional()
}).min(1);

// ==================== MEDICATIONS ====================

const createMedicationSchema = Joi.object({
  medication_name: Joi.string().min(1).max(255).required()
    .messages({
      'string.empty': 'Medication name is required',
      'string.max': 'Medication name must not exceed 255 characters'
    }),
  
  medication_type: Joi.string()
    .valid('tablet', 'liquid', 'injection', 'topical')
    .allow(null, '')
    .optional(),
  
  dosage: Joi.string().min(1).max(100).required()
    .messages({
      'string.empty': 'Dosage is required'
    }),
  
  frequency: Joi.string().min(1).max(100).required()
    .messages({
      'string.empty': 'Frequency is required'
    }),
  
  route: Joi.string()
    .valid('oral', 'topical', 'injection')
    .allow(null, '')
    .optional(),
  
  start_date: Joi.date().required()
    .messages({
      'any.required': 'Start date is required'
    }),
  
  end_date: Joi.date().min(Joi.ref('start_date')).allow(null).optional()
    .messages({
      'date.min': 'End date must be after start date'
    }),
  
  prescribed_by: Joi.string().max(255).allow(null, '').optional(),
  prescribed_for: Joi.string().max(255).allow(null, '').optional(),
  pharmacy: Joi.string().max(255).allow(null, '').optional(),
  refills_remaining: Joi.number().integer().min(0).allow(null).optional(),
  reminder_enabled: Joi.boolean().optional(),
  reminder_times: Joi.array().items(Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)).allow(null).optional(),
  side_effects: Joi.string().allow(null, '').optional(),
  instructions: Joi.string().allow(null, '').optional(),
  notes: Joi.string().allow(null, '').optional()
});

const updateMedicationSchema = Joi.object({
  medication_name: Joi.string().min(1).max(255).optional(),
  medication_type: Joi.string().valid('tablet', 'liquid', 'injection', 'topical').allow(null, '').optional(),
  dosage: Joi.string().min(1).max(100).optional(),
  frequency: Joi.string().min(1).max(100).optional(),
  route: Joi.string().valid('oral', 'topical', 'injection').allow(null, '').optional(),
  start_date: Joi.date().optional(),
  end_date: Joi.date().allow(null).optional(),
  prescribed_by: Joi.string().max(255).allow(null, '').optional(),
  prescribed_for: Joi.string().max(255).allow(null, '').optional(),
  pharmacy: Joi.string().max(255).allow(null, '').optional(),
  refills_remaining: Joi.number().integer().min(0).allow(null).optional(),
  is_active: Joi.boolean().optional(),
  reminder_enabled: Joi.boolean().optional(),
  reminder_times: Joi.array().items(Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)).allow(null).optional(),
  side_effects: Joi.string().allow(null, '').optional(),
  instructions: Joi.string().allow(null, '').optional(),
  notes: Joi.string().allow(null, '').optional()
}).min(1);

// ==================== PET INSURANCE ====================

const createInsuranceSchema = Joi.object({
  insurer_name: Joi.string().min(1).max(255).required()
    .messages({
      'string.empty': 'Insurer name is required'
    }),
  
  policy_number: Joi.string().min(1).max(100).required()
    .messages({
      'string.empty': 'Policy number is required'
    }),
  
  policy_holder_name: Joi.string().max(255).allow(null, '').optional(),
  
  coverage_type: Joi.string()
    .valid('basic', 'comprehensive', 'lifetime', 'accident_only')
    .allow(null, '')
    .optional(),
  
  coverage_amount: Joi.number().positive().allow(null).optional(),
  deductible_amount: Joi.number().positive().allow(null).optional(),
  premium_amount: Joi.number().positive().allow(null).optional(),
  
  premium_frequency: Joi.string()
    .valid('monthly', 'quarterly', 'annual')
    .allow(null, '')
    .optional(),
  
  start_date: Joi.date().required()
    .messages({
      'any.required': 'Start date is required'
    }),
  
  end_date: Joi.date().min(Joi.ref('start_date')).required()
    .messages({
      'date.min': 'End date must be after start date',
      'any.required': 'End date is required'
    }),
  
  renewal_date: Joi.date().allow(null).optional(),
  claim_phone: Joi.string().max(50).allow(null, '').optional(),
  claim_email: Joi.string().email().allow(null, '').optional(),
  exclusions: Joi.string().allow(null, '').optional(),
  documents_urls: Joi.array().items(Joi.string().uri()).allow(null).optional()
});

const updateInsuranceSchema = Joi.object({
  insurer_name: Joi.string().min(1).max(255).optional(),
  policy_holder_name: Joi.string().max(255).allow(null, '').optional(),
  coverage_type: Joi.string().valid('basic', 'comprehensive', 'lifetime', 'accident_only').allow(null, '').optional(),
  coverage_amount: Joi.number().positive().allow(null).optional(),
  deductible_amount: Joi.number().positive().allow(null).optional(),
  premium_amount: Joi.number().positive().allow(null).optional(),
  premium_frequency: Joi.string().valid('monthly', 'quarterly', 'annual').allow(null, '').optional(),
  start_date: Joi.date().optional(),
  end_date: Joi.date().optional(),
  renewal_date: Joi.date().allow(null).optional(),
  claim_phone: Joi.string().max(50).allow(null, '').optional(),
  claim_email: Joi.string().email().allow(null, '').optional(),
  exclusions: Joi.string().allow(null, '').optional(),
  documents_urls: Joi.array().items(Joi.string().uri()).allow(null).optional(),
  is_active: Joi.boolean().optional()
}).min(1);

// ==================== GROWTH TRACKING ====================

const createGrowthRecordSchema = Joi.object({
  measurement_date: Joi.date().max('now').required()
    .messages({
      'date.max': 'Measurement date cannot be in the future',
      'any.required': 'Measurement date is required'
    }),
  
  weight: Joi.number().positive().max(200).allow(null).optional()
    .messages({
      'number.positive': 'Weight must be positive'
    }),
  
  height: Joi.number().positive().max(200).allow(null).optional()
    .messages({
      'number.positive': 'Height must be positive'
    }),
  
  length: Joi.number().positive().max(300).allow(null).optional()
    .messages({
      'number.positive': 'Length must be positive'
    }),
  
  body_condition_score: Joi.number().integer().min(1).max(9).allow(null).optional()
    .messages({
      'number.min': 'Body condition score must be between 1 and 9',
      'number.max': 'Body condition score must be between 1 and 9'
    }),
  
  notes: Joi.string().allow(null, '').optional(),
  photo_url: Joi.string().uri().allow(null, '').optional()
});

const updateGrowthRecordSchema = Joi.object({
  measurement_date: Joi.date().max('now').optional(),
  weight: Joi.number().positive().max(200).allow(null).optional(),
  height: Joi.number().positive().max(200).allow(null).optional(),
  length: Joi.number().positive().max(300).allow(null).optional(),
  body_condition_score: Joi.number().integer().min(1).max(9).allow(null).optional(),
  notes: Joi.string().allow(null, '').optional(),
  photo_url: Joi.string().uri().allow(null, '').optional()
}).min(1);

// Export all schemas
module.exports = {
  updateProfileSchema,
  createAddressSchema,
  updateAddressSchema,
  updatePreferencesSchema,
  updateNotificationPreferencesSchema,
  updatePhoneSchema,
  updateEmailSchema,
  
  // Pet schemas
  createPetSchema,
  updatePetSchema,
  markPetDeceasedSchema,
  
  // Health records
  createHealthRecordSchema,
  updateHealthRecordSchema,
  
  // Vaccinations
  createVaccinationSchema,
  updateVaccinationSchema,
  
  // Medications
  createMedicationSchema,
  updateMedicationSchema,
  
  // Insurance
  createInsuranceSchema,
  updateInsuranceSchema,
  
  // Growth tracking
  createGrowthRecordSchema,
  updateGrowthRecordSchema
};