const Joi = require("joi");

const updateProfileSchema = Joi.object({
  full_name: Joi.string().min(2).max(255).trim(),
  email: Joi.string().email().lowercase().trim(),
  date_of_birth: Joi.date().max("now").iso(),
});

const createAddressSchema = Joi.object({
  label: Joi.string().valid("home", "work", "other").required(),
  address_line1: Joi.string().min(5).max(255).required(),
  address_line2: Joi.string().max(255).allow("", null),
  landmark: Joi.string().max(255).allow("", null),
  city: Joi.string().min(2).max(100).required(),
  state: Joi.string().min(2).max(100).required(),
  pincode: Joi.string()
    .pattern(/^\d{6}$/)
    .required(),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  is_default: Joi.boolean(),
});

const updateAddressSchema = Joi.object({
  label: Joi.string().valid("home", "work", "other"),
  address_line1: Joi.string().min(5).max(255),
  address_line2: Joi.string().max(255).allow("", null),
  landmark: Joi.string().max(255).allow("", null),
  city: Joi.string().min(2).max(100),
  state: Joi.string().min(2).max(100),
  pincode: Joi.string().pattern(/^\d{6}$/),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  is_default: Joi.boolean(),
});

const updatePreferencesSchema = Joi.object({
  language: Joi.string().valid("en", "hi"),
  timezone: Joi.string(),
  notification_enabled: Joi.boolean(),
  sms_enabled: Joi.boolean(),
  email_enabled: Joi.boolean(),
  push_enabled: Joi.boolean(),
  whatsapp_enabled: Joi.boolean(),
  theme: Joi.string().valid("light", "dark", "auto"),
});

// const updateNotificationPreferencesSchema = Joi.object({
//   booking_confirmations: Joi.boolean(),
//   booking_reminders: Joi.boolean(),
//   health_reminders: Joi.boolean(),
//   vaccination_reminders: Joi.boolean(),
//   medication_reminders: Joi.boolean(),
//   subscription_updates: Joi.boolean(),
//   payment_alerts: Joi.boolean(),
//   promotional: Joi.boolean(),
//   community_events: Joi.boolean(),
//   care_manager_updates: Joi.boolean(),
//   sms_enabled: Joi.boolean(),
//   email_enabled: Joi.boolean(),
//   push_enabled: Joi.boolean(),
//   whatsapp_enabled: Joi.boolean(),
//   quiet_hours_start: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/),
//   quiet_hours_end: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/),
// });

const updatePhoneSchema = Joi.object({
  new_phone: Joi.string()
    .pattern(/^(\+91)?[6-9]\d{9}$/)
    .required()
    .messages({
      "string.pattern.base":
        "Phone number must be a valid 10-digit Indian number, optionally starting with +91",
      "any.required": "Phone number is required",
    }),
  otp: Joi.string().length(6).required(),
});

const updateEmailSchema = Joi.object({
  new_email: Joi.string().email().lowercase().required(),
  otp: Joi.string().length(6).required(),
});

// ==================== PET VALIDATION SCHEMAS ====================

const createPetSchema = Joi.object({
  name: Joi.string().min(1).max(100).required().messages({
    "string.empty": "Pet name is required",
    "string.max": "Pet name must not exceed 100 characters",
  }),

  species_id: Joi.number().integer().positive().required().messages({
    "number.base": "Species ID must be a number",
    "any.required": "Species is required",
  }),

  breed: Joi.string().max(100).allow(null, "").optional(),

  gender_id: Joi.number().integer().positive().allow(null).optional(),

  date_of_birth: Joi.date().max("now").required().messages({
    "date.max": "Date of birth cannot be in the future",
    "any.required": "Date of birth is required",
  }),

  weight: Joi.number().positive().max(200).allow(null).optional().messages({
    "number.positive": "Weight must be positive",
    "number.max": "Weight seems unrealistic",
  }),

  color: Joi.string().max(50).allow(null, "").optional(),

  microchip_id: Joi.string().max(50).allow(null, "").optional(),

  medical_conditions: Joi.string().allow(null, "").optional(),

  behavioral_notes: Joi.string().allow(null, "").optional(),
});

const updatePetSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  breed: Joi.string().max(100).allow(null, "").optional(),
  gender_id: Joi.number().integer().positive().allow(null).optional(),
  date_of_birth: Joi.date().max("now").optional(),
  weight: Joi.number().positive().max(200).allow(null).optional(),
  color: Joi.string().max(50).allow(null, "").optional(),
  microchip_id: Joi.string().max(50).allow(null, "").optional(),
  medical_conditions: Joi.string().allow(null, "").optional(),
  behavioral_notes: Joi.string().allow(null, "").optional(),
}).min(1);

const markPetDeceasedSchema = Joi.object({
  deceased_date: Joi.date().max("now").required().messages({
    "date.max": "Deceased date cannot be in the future",
    "any.required": "Deceased date is required",
  }),
});

// ==================== HEALTH RECORDS ====================

const createHealthRecordSchema = Joi.object({
  record_type: Joi.string()
    .valid(
      "vaccination",
      "vet_visit",
      "medication",
      "surgery",
      "allergy",
      "condition",
      "test_result"
    )
    .required()
    .messages({
      "any.only": "Invalid record type",
      "any.required": "Record type is required",
    }),

  title: Joi.string().min(1).max(255).required().messages({
    "string.empty": "Title is required",
    "string.max": "Title must not exceed 255 characters",
  }),

  description: Joi.string().allow(null, "").optional(),

  record_date: Joi.date().max("now").required().messages({
    "date.max": "Record date cannot be in the future",
    "any.required": "Record date is required",
  }),

  provider_name: Joi.string().max(255).allow(null, "").optional(),
  provider_contact: Joi.string().max(50).allow(null, "").optional(),
  provider_address: Joi.string().allow(null, "").optional(),
  document_urls: Joi.array().items(Joi.string().uri()).allow(null).optional(),
  diagnosis: Joi.string().allow(null, "").optional(),
  treatment_plan: Joi.string().allow(null, "").optional(),
  notes: Joi.string().allow(null, "").optional(),

  cost: Joi.number().positive().allow(null).optional().messages({
    "number.positive": "Cost must be positive",
  }),
});

const updateHealthRecordSchema = Joi.object({
  record_type: Joi.string()
    .valid(
      "vaccination",
      "vet_visit",
      "medication",
      "surgery",
      "allergy",
      "condition",
      "test_result"
    )
    .optional(),
  title: Joi.string().min(1).max(255).optional(),
  description: Joi.string().allow(null, "").optional(),
  record_date: Joi.date().max("now").optional(),
  provider_name: Joi.string().max(255).allow(null, "").optional(),
  provider_contact: Joi.string().max(50).allow(null, "").optional(),
  provider_address: Joi.string().allow(null, "").optional(),
  document_urls: Joi.array().items(Joi.string().uri()).allow(null).optional(),
  diagnosis: Joi.string().allow(null, "").optional(),
  treatment_plan: Joi.string().allow(null, "").optional(),
  notes: Joi.string().allow(null, "").optional(),
  cost: Joi.number().positive().allow(null).optional(),
}).min(1);

// ==================== VACCINATIONS ====================

const createVaccinationSchema = Joi.object({
  vaccine_name: Joi.string().min(1).max(255).required().messages({
    "string.empty": "Vaccine name is required",
    "string.max": "Vaccine name must not exceed 255 characters",
  }),

  vaccination_date: Joi.date().max("now").required().messages({
    "date.max": "Vaccination date cannot be in the future",
    "any.required": "Vaccination date is required",
  }),

  next_due_date: Joi.date().allow(null).optional(),
  batch_number: Joi.string().max(100).allow(null, "").optional(),
  provider: Joi.string().max(255).allow(null, "").optional(),
  provider_contact: Joi.string().max(50).allow(null, "").optional(),
  veterinarian_name: Joi.string().max(255).allow(null, "").optional(),
  vaccination_site: Joi.string().max(100).allow(null, "").optional(),
  adverse_reactions: Joi.string().allow(null, "").optional(),
  certificate_url: Joi.string().uri().allow(null, "").optional(),
  notes: Joi.string().allow(null, "").optional(),
});

const updateVaccinationSchema = Joi.object({
  vaccine_name: Joi.string().min(1).max(255).optional(),
  vaccination_date: Joi.date().max("now").optional(),
  next_due_date: Joi.date().allow(null).optional(),
  batch_number: Joi.string().max(100).allow(null, "").optional(),
  provider: Joi.string().max(255).allow(null, "").optional(),
  provider_contact: Joi.string().max(50).allow(null, "").optional(),
  veterinarian_name: Joi.string().max(255).allow(null, "").optional(),
  vaccination_site: Joi.string().max(100).allow(null, "").optional(),
  adverse_reactions: Joi.string().allow(null, "").optional(),
  certificate_url: Joi.string().uri().allow(null, "").optional(),
  is_completed: Joi.boolean().optional(),
  notes: Joi.string().allow(null, "").optional(),
}).min(1);

// ==================== MEDICATIONS ====================

const createMedicationSchema = Joi.object({
  medication_name: Joi.string().min(1).max(255).required().messages({
    "string.empty": "Medication name is required",
    "string.max": "Medication name must not exceed 255 characters",
  }),

  medication_type: Joi.string()
    .valid("tablet", "liquid", "injection", "topical")
    .allow(null, "")
    .optional(),

  dosage: Joi.string().min(1).max(100).required().messages({
    "string.empty": "Dosage is required",
  }),

  frequency: Joi.string().min(1).max(100).required().messages({
    "string.empty": "Frequency is required",
  }),

  route: Joi.string()
    .valid("oral", "topical", "injection")
    .allow(null, "")
    .optional(),

  start_date: Joi.date().required().messages({
    "any.required": "Start date is required",
  }),

  end_date: Joi.date()
    .min(Joi.ref("start_date"))
    .allow(null)
    .optional()
    .messages({
      "date.min": "End date must be after start date",
    }),

  prescribed_by: Joi.string().max(255).allow(null, "").optional(),
  prescribed_for: Joi.string().max(255).allow(null, "").optional(),
  pharmacy: Joi.string().max(255).allow(null, "").optional(),
  refills_remaining: Joi.number().integer().min(0).allow(null).optional(),
  reminder_enabled: Joi.boolean().optional(),
  reminder_times: Joi.array()
    .items(Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/))
    .allow(null)
    .optional(),
  side_effects: Joi.string().allow(null, "").optional(),
  instructions: Joi.string().allow(null, "").optional(),
  notes: Joi.string().allow(null, "").optional(),
});

const updateMedicationSchema = Joi.object({
  medication_name: Joi.string().min(1).max(255).optional(),
  medication_type: Joi.string()
    .valid("tablet", "liquid", "injection", "topical")
    .allow(null, "")
    .optional(),
  dosage: Joi.string().min(1).max(100).optional(),
  frequency: Joi.string().min(1).max(100).optional(),
  route: Joi.string()
    .valid("oral", "topical", "injection")
    .allow(null, "")
    .optional(),
  start_date: Joi.date().optional(),
  end_date: Joi.date().allow(null).optional(),
  prescribed_by: Joi.string().max(255).allow(null, "").optional(),
  prescribed_for: Joi.string().max(255).allow(null, "").optional(),
  pharmacy: Joi.string().max(255).allow(null, "").optional(),
  refills_remaining: Joi.number().integer().min(0).allow(null).optional(),
  is_active: Joi.boolean().optional(),
  reminder_enabled: Joi.boolean().optional(),
  reminder_times: Joi.array()
    .items(Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/))
    .allow(null)
    .optional(),
  side_effects: Joi.string().allow(null, "").optional(),
  instructions: Joi.string().allow(null, "").optional(),
  notes: Joi.string().allow(null, "").optional(),
}).min(1);

// ==================== PET INSURANCE ====================

const createInsuranceSchema = Joi.object({
  insurer_name: Joi.string().min(1).max(255).required().messages({
    "string.empty": "Insurer name is required",
  }),

  policy_number: Joi.string().min(1).max(100).required().messages({
    "string.empty": "Policy number is required",
  }),

  policy_holder_name: Joi.string().max(255).allow(null, "").optional(),

  coverage_type: Joi.string()
    .valid("basic", "comprehensive", "lifetime", "accident_only")
    .allow(null, "")
    .optional(),

  coverage_amount: Joi.number().positive().allow(null).optional(),
  deductible_amount: Joi.number().positive().allow(null).optional(),
  premium_amount: Joi.number().positive().allow(null).optional(),

  premium_frequency: Joi.string()
    .valid("monthly", "quarterly", "annual")
    .allow(null, "")
    .optional(),

  start_date: Joi.date().required().messages({
    "any.required": "Start date is required",
  }),

  end_date: Joi.date().min(Joi.ref("start_date")).required().messages({
    "date.min": "End date must be after start date",
    "any.required": "End date is required",
  }),

  renewal_date: Joi.date().allow(null).optional(),
  claim_phone: Joi.string().max(50).allow(null, "").optional(),
  claim_email: Joi.string().email().allow(null, "").optional(),
  exclusions: Joi.string().allow(null, "").optional(),
  documents_urls: Joi.array().items(Joi.string().uri()).allow(null).optional(),
});

const updateInsuranceSchema = Joi.object({
  insurer_name: Joi.string().min(1).max(255).optional(),
  policy_holder_name: Joi.string().max(255).allow(null, "").optional(),
  coverage_type: Joi.string()
    .valid("basic", "comprehensive", "lifetime", "accident_only")
    .allow(null, "")
    .optional(),
  coverage_amount: Joi.number().positive().allow(null).optional(),
  deductible_amount: Joi.number().positive().allow(null).optional(),
  premium_amount: Joi.number().positive().allow(null).optional(),
  premium_frequency: Joi.string()
    .valid("monthly", "quarterly", "annual")
    .allow(null, "")
    .optional(),
  start_date: Joi.date().optional(),
  end_date: Joi.date().optional(),
  renewal_date: Joi.date().allow(null).optional(),
  claim_phone: Joi.string().max(50).allow(null, "").optional(),
  claim_email: Joi.string().email().allow(null, "").optional(),
  exclusions: Joi.string().allow(null, "").optional(),
  documents_urls: Joi.array().items(Joi.string().uri()).allow(null).optional(),
  is_active: Joi.boolean().optional(),
}).min(1);

// ==================== GROWTH TRACKING ====================

const createGrowthRecordSchema = Joi.object({
  measurement_date: Joi.date().max("now").required().messages({
    "date.max": "Measurement date cannot be in the future",
    "any.required": "Measurement date is required",
  }),

  weight: Joi.number().positive().max(200).allow(null).optional().messages({
    "number.positive": "Weight must be positive",
  }),

  height: Joi.number().positive().max(200).allow(null).optional().messages({
    "number.positive": "Height must be positive",
  }),

  length: Joi.number().positive().max(300).allow(null).optional().messages({
    "number.positive": "Length must be positive",
  }),

  body_condition_score: Joi.number()
    .integer()
    .min(1)
    .max(9)
    .allow(null)
    .optional()
    .messages({
      "number.min": "Body condition score must be between 1 and 9",
      "number.max": "Body condition score must be between 1 and 9",
    }),

  notes: Joi.string().allow(null, "").optional(),
  photo_url: Joi.string().uri().allow(null, "").optional(),
});

const updateGrowthRecordSchema = Joi.object({
  measurement_date: Joi.date().max("now").optional(),
  weight: Joi.number().positive().max(200).allow(null).optional(),
  height: Joi.number().positive().max(200).allow(null).optional(),
  length: Joi.number().positive().max(300).allow(null).optional(),
  body_condition_score: Joi.number()
    .integer()
    .min(1)
    .max(9)
    .allow(null)
    .optional(),
  notes: Joi.string().allow(null, "").optional(),
  photo_url: Joi.string().uri().allow(null, "").optional(),
}).min(1);

// ==================== SUBSCRIPTION SCHEMAS ====================

const createSubscriptionSchema = Joi.object({
  pet_id: Joi.string().uuid().required().messages({
    "string.guid": "Invalid pet ID format",
    "any.required": "Pet ID is required",
  }),
  tier_id: Joi.number().integer().min(1).max(3).required().messages({
    "number.base": "Tier ID must be a number",
    "number.min": "Invalid tier ID",
    "number.max": "Invalid tier ID",
    "any.required": "Tier ID is required",
  }),
  billing_cycle_id: Joi.number().integer().min(1).max(2).required().messages({
    "number.base": "Billing cycle ID must be a number",
    "number.min": "Invalid billing cycle",
    "number.max": "Invalid billing cycle",
    "any.required": "Billing cycle is required",
  }),
  promo_code: Joi.string().uppercase().max(50).optional().messages({
    "string.max": "Promo code too long",
  }),
});

const upgradeSubscriptionSchema = Joi.object({
  new_tier_id: Joi.number().integer().min(1).max(3).required().messages({
    "number.base": "New tier ID must be a number",
    "any.required": "New tier ID is required",
  }),
  new_billing_cycle_id: Joi.number()
    .integer()
    .min(1)
    .max(2)
    .optional()
    .messages({
      "number.base": "Billing cycle ID must be a number",
    }),
});

const downgradeSubscriptionSchema = Joi.object({
  new_tier_id: Joi.number().integer().min(1).max(3).required().messages({
    "number.base": "New tier ID must be a number",
    "any.required": "New tier ID is required",
  }),
  new_billing_cycle_id: Joi.number()
    .integer()
    .min(1)
    .max(2)
    .optional()
    .messages({
      "number.base": "Billing cycle ID must be a number",
    }),
});

const pauseSubscriptionSchema = Joi.object({
  reason: Joi.string().max(500).required().messages({
    "string.max": "Reason too long",
    "any.required": "Reason is required",
  }),
  resume_date: Joi.date().min("now").required().messages({
    "date.base": "Invalid resume date",
    "date.min": "Resume date must be in the future",
    "any.required": "Resume date is required",
  }),
});

const cancelSubscriptionSchema = Joi.object({
  reason: Joi.string().max(500).required().messages({
    "string.max": "Reason too long",
    "any.required": "Cancellation reason is required",
  }),
  immediate: Joi.boolean().default(false).messages({
    "boolean.base": "Immediate must be true or false",
  }),
});

const toggleAutoRenewalSchema = Joi.object({
  auto_renew: Joi.boolean().required().messages({
    "boolean.base": "Auto renew must be true or false",
    "any.required": "Auto renew setting is required",
  }),
});

const validatePromoCodeSchema = Joi.object({
  promo_code: Joi.string().uppercase().max(50).required().messages({
    "string.max": "Promo code too long",
    "any.required": "Promo code is required",
  }),
  tier_id: Joi.number().integer().min(1).max(3).required().messages({
    "any.required": "Tier ID is required",
  }),
  billing_cycle_id: Joi.number().integer().min(1).max(2).required().messages({
    "any.required": "Billing cycle is required",
  }),
});

const calculatePriceSchema = Joi.object({
  tier_id: Joi.number().integer().min(1).max(3).required().messages({
    "any.required": "Tier ID is required",
  }),
  billing_cycle_id: Joi.number().integer().min(1).max(2).required().messages({
    "any.required": "Billing cycle is required",
  }),
  promo_code: Joi.string().uppercase().max(50).optional().messages({
    "string.max": "Promo code too long",
  }),
});

// ==================== PAYMENT METHOD SCHEMAS ====================

const addPaymentMethodSchema = Joi.object({
  method_type: Joi.string()
    .valid("card", "upi", "netbanking", "wallet")
    .required()
    .messages({
      "any.only": "Invalid payment method type",
      "any.required": "Payment method type is required",
    }),

  provider: Joi.string()
    .valid("razorpay", "stripe", "paytm", "phonepe", "gpay")
    .required()
    .messages({
      "any.only": "Invalid payment provider",
      "any.required": "Payment provider is required",
    }),

  token: Joi.string().max(500).required().messages({
    "string.max": "Token too long",
    "any.required": "Payment token is required",
  }),

  // Card-specific fields (required if method_type is 'card')
  card_brand: Joi.when("method_type", {
    is: "card",
    then: Joi.string().valid("visa", "mastercard", "rupay", "amex").required(),
    otherwise: Joi.string().optional().allow(null, ""),
  }),

  last_four: Joi.when("method_type", {
    is: "card",
    then: Joi.string().length(4).pattern(/^\d+$/).required(),
    otherwise: Joi.string().optional().allow(null, ""),
  }),

  expiry_month: Joi.when("method_type", {
    is: "card",
    then: Joi.string()
      .length(2)
      .pattern(/^(0[1-9]|1[0-2])$/)
      .required(),
    otherwise: Joi.string().optional().allow(null, ""),
  }),

  expiry_year: Joi.when("method_type", {
    is: "card",
    then: Joi.string()
      .length(4)
      .pattern(/^\d{4}$/)
      .required(),
    otherwise: Joi.string().optional().allow(null, ""),
  }),

  cardholder_name: Joi.when("method_type", {
    is: "card",
    then: Joi.string().min(2).max(255).required(),
    otherwise: Joi.string().optional().allow(null, ""),
  }),

  billing_address_id: Joi.string().uuid().optional().allow(null),

  is_default: Joi.boolean().optional(),

  is_verified: Joi.boolean().optional(),
});

// ==================== PAYMENT PROCESSING SCHEMAS ====================

const processPaymentSchema = Joi.object({
  invoice_id: Joi.string().uuid().required().messages({
    "string.guid": "Invalid invoice ID format",
    "any.required": "Invoice ID is required",
  }),

  payment_method_id: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Invalid payment method ID format",
  }),

  payment_gateway: Joi.string()
    .valid("razorpay", "stripe", "paytm")
    .default("razorpay")
    .messages({
      "any.only": "Invalid payment gateway",
    }),

  payment_method_used: Joi.string()
    .valid("card", "upi", "netbanking", "wallet")
    .optional()
    .messages({
      "any.only": "Invalid payment method",
    }),

  // Razorpay-specific fields
  razorpay_payment_id: Joi.string().optional(),
  razorpay_order_id: Joi.string().optional(),
  razorpay_signature: Joi.string().optional(),
});

const verifyPaymentSchema = Joi.object({
  order_id: Joi.string().required().messages({
    "any.required": "Order ID is required",
  }),

  payment_id: Joi.string().required().messages({
    "any.required": "Payment ID is required",
  }),

  signature: Joi.string().required().messages({
    "any.required": "Payment signature is required",
  }),
});

// ==================== REFUND SCHEMAS ====================

const requestRefundSchema = Joi.object({
  payment_id: Joi.string().uuid().required().messages({
    "string.guid": "Invalid payment ID format",
    "any.required": "Payment ID is required",
  }),

  booking_id: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Invalid booking ID format",
  }),

  refund_amount: Joi.number().positive().precision(2).required().messages({
    "number.positive": "Refund amount must be positive",
    "any.required": "Refund amount is required",
  }),

  refund_type: Joi.string()
    .valid("full", "partial", "cancellation", "error")
    .default("full")
    .messages({
      "any.only": "Invalid refund type",
    }),

  reason: Joi.string().min(10).max(255).required().messages({
    "string.min": "Reason must be at least 10 characters",
    "string.max": "Reason must not exceed 255 characters",
    "any.required": "Refund reason is required",
  }),

  detailed_reason: Joi.string().max(1000).optional().allow(null, "").messages({
    "string.max": "Detailed reason must not exceed 1000 characters",
  }),
});

// ==================== INVOICE CREATION SCHEMA ====================

const createInvoiceSchema = Joi.object({
  user_id: Joi.string().uuid().optional().messages({
    "string.guid": "Invalid user ID format",
  }),

  subscription_id: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Invalid subscription ID format",
  }),

  booking_id: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Invalid booking ID format",
  }),

  invoice_type: Joi.string()
    .valid("subscription", "service", "addon", "refund")
    .required()
    .messages({
      "any.only": "Invalid invoice type",
      "any.required": "Invoice type is required",
    }),

  line_items: Joi.array()
    .items(
      Joi.object({
        item_type: Joi.string()
          .valid("subscription", "service", "addon", "tax", "discount")
          .required(),
        description: Joi.string().min(1).max(255).required(),
        quantity: Joi.number().integer().positive().default(1),
        unit_price: Joi.number().positive().precision(2).required(),
        tax_applicable: Joi.boolean().default(true),
      })
    )
    .min(1)
    .required()
    .messages({
      "array.min": "At least one line item is required",
      "any.required": "Line items are required",
    }),

  tax_percentage: Joi.number()
    .min(0)
    .max(100)
    .precision(2)
    .default(18)
    .messages({
      "number.min": "Tax percentage cannot be negative",
      "number.max": "Tax percentage cannot exceed 100",
    }),

  discount_percentage: Joi.number()
    .min(0)
    .max(100)
    .precision(2)
    .default(0)
    .messages({
      "number.min": "Discount percentage cannot be negative",
      "number.max": "Discount percentage cannot exceed 100",
    }),

  discount_amount: Joi.number().min(0).precision(2).optional().messages({
    "number.min": "Discount amount cannot be negative",
  }),

  due_date: Joi.date().min("now").optional().messages({
    "date.min": "Due date cannot be in the past",
  }),

  notes: Joi.string().max(1000).optional().allow(null, "").messages({
    "string.max": "Notes must not exceed 1000 characters",
  }),
});

// ==================== PROMO CODE VALIDATION ====================

const applyPromoCodeSchema = Joi.object({
  promo_code: Joi.string().uppercase().max(50).required().messages({
    "string.max": "Promo code too long",
    "any.required": "Promo code is required",
  }),

  invoice_id: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Invalid invoice ID format",
  }),

  amount: Joi.number().positive().precision(2).optional().messages({
    "number.positive": "Amount must be positive",
  }),
});

// ==================== BOOKING VALIDATION SCHEMAS ====================

const createBookingSchema = Joi.object({
  pet_id: Joi.string().uuid().required().messages({
    "string.guid": "Invalid pet ID format",
    "any.required": "Pet ID is required",
  }),

  service_id: Joi.string().uuid().required().messages({
    "string.guid": "Invalid service ID format",
    "any.required": "Service ID is required",
  }),

  booking_date: Joi.date().required().messages({
    "date.base": "Invalid booking date",
    "any.required": "Booking date is required",
  }),

  booking_time: Joi.string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)
    .required()
    .messages({
      "string.pattern.base": "Time must be in HH:MM:SS format",
      "any.required": "Booking time is required",
    }),

  location_type_id: Joi.number().integer().min(1).max(2).required().messages({
    "number.base": "Location type must be a number",
    "number.min": "Invalid location type",
    "number.max": "Invalid location type",
    "any.required": "Location type is required",
  }),

  address_id: Joi.string().uuid().allow(null).optional().messages({
    "string.guid": "Invalid address ID format",
  }),

  specific_location_notes: Joi.string()
    .max(500)
    .allow("", null)
    .optional()
    .messages({
      "string.max": "Location notes too long",
    }),

  special_instructions: Joi.string()
    .max(1000)
    .allow("", null)
    .optional()
    .messages({
      "string.max": "Special instructions too long",
    }),

  pet_behavior_notes: Joi.string()
    .max(1000)
    .allow("", null)
    .optional()
    .messages({
      "string.max": "Behavior notes too long",
    }),

  use_subscription: Joi.boolean().default(false).messages({
    "boolean.base": "Use subscription must be true or false",
  }),

  addons: Joi.array()
    .items(
      Joi.object({
        addon_type: Joi.string()
          .valid("product", "service_upgrade", "extra_service")
          .required(),
        addon_name: Joi.string().max(255).required(),
        addon_description: Joi.string().max(500).allow("", null).optional(),
        unit_price: Joi.number().positive().required(),
        quantity: Joi.number().integer().min(1).default(1),
      })
    )
    .optional(),
});

const cancelBookingSchema = Joi.object({
  reason: Joi.string().min(10).max(500).required().messages({
    "string.min": "Please provide a reason (at least 10 characters)",
    "string.max": "Reason too long (max 500 characters)",
    "any.required": "Cancellation reason is required",
  }),
});

const rescheduleBookingSchema = Joi.object({
  new_date: Joi.date().min("now").required().messages({
    "date.base": "Invalid date",
    "date.min": "New date cannot be in the past",
    "any.required": "New date is required",
  }),

  new_time: Joi.string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)
    .required()
    .messages({
      "string.pattern.base": "Time must be in HH:MM:SS format",
      "any.required": "New time is required",
    }),

  reason: Joi.string().min(10).max(500).required().messages({
    "string.min": "Please provide a reason (at least 10 characters)",
    "string.max": "Reason too long (max 500 characters)",
    "any.required": "Rescheduling reason is required",
  }),
});

const calculateBookingPriceSchema = Joi.object({
  service_id: Joi.string().uuid().required().messages({
    "string.guid": "Invalid service ID format",
    "any.required": "Service ID is required",
  }),

  pet_id: Joi.string().uuid().required().messages({
    "string.guid": "Invalid pet ID format",
    "any.required": "Pet ID is required",
  }),

  addons: Joi.array()
    .items(
      Joi.object({
        addon_type: Joi.string()
          .valid("product", "service_upgrade", "extra_service")
          .required(),
        addon_name: Joi.string().max(255).required(),
        addon_description: Joi.string().max(500).allow("", null).optional(),
        unit_price: Joi.number().positive().required(),
        quantity: Joi.number().integer().min(1).default(1),
      })
    )
    .optional(),

  promo_code: Joi.string().uppercase().max(50).optional().messages({
    "string.max": "Promo code too long",
  }),
});

// ==================== CAREGIVER VALIDATION SCHEMAS ====================

const updateCaregiverProfileSchema = Joi.object({
  full_name: Joi.string().min(2).max(255).trim().optional(),
  email: Joi.string().email().lowercase().trim().optional(),
  address: Joi.string().max(500).allow(null, "").optional(),
  city: Joi.string().max(100).optional(),
  state: Joi.string().max(100).optional(),
  pincode: Joi.string()
    .pattern(/^\d{6}$/)
    .optional(),
  emergency_contact_name: Joi.string().max(255).allow(null, "").optional(),
  emergency_contact_phone: Joi.string()
    .pattern(/^\+?[6-9]\d{9}$/)
    .allow(null, "")
    .optional(),
  experience_years: Joi.number()
    .integer()
    .min(0)
    .max(50)
    .allow(null)
    .optional(),
  education: Joi.string().max(255).allow(null, "").optional(),
  certifications: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        issuing_org: Joi.string().optional(),
        issue_date: Joi.date().optional(),
        expiry_date: Joi.date().optional(),
        url: Joi.string().uri().optional(),
      })
    )
    .allow(null)
    .optional(),
  languages_spoken: Joi.array().items(Joi.string()).allow(null).optional(),
  specializations: Joi.array().items(Joi.string()).allow(null).optional(),
  service_area_pincodes: Joi.array()
    .items(Joi.string().pattern(/^\d{6}$/))
    .allow(null)
    .optional(),
  bank_account_number: Joi.string().max(50).allow(null, "").optional(),
  ifsc_code: Joi.string()
    .pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .allow(null, "")
    .optional()
    .messages({
      "string.pattern.base": "Invalid IFSC code format",
    }),
});

const addSpecializationSchema = Joi.object({
  category_id: Joi.number().integer().positive().required().messages({
    "number.base": "Category ID must be a number",
    "any.required": "Category ID is required",
  }),
  proficiency_level: Joi.string()
    .valid("beginner", "intermediate", "expert")
    .optional(),
  certification_name: Joi.string().max(255).allow(null, "").optional(),
  certification_url: Joi.string().uri().allow(null, "").optional(),
  years_experience: Joi.number()
    .integer()
    .min(0)
    .max(50)
    .allow(null)
    .optional(),
});

const rejectAssignmentSchema = Joi.object({
  rejection_reason: Joi.string().min(10).max(500).required().messages({
    "string.min": "Rejection reason must be at least 10 characters",
    "string.max": "Rejection reason must not exceed 500 characters",
    "any.required": "Rejection reason is required",
  }),
});

const startServiceSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
});

const completeServiceSchema = Joi.object({
  pre_service_checklist: Joi.object().optional(),
  post_service_checklist: Joi.object().optional(),
  before_photos: Joi.array().items(Joi.string().uri()).optional(),
  after_photos: Joi.array().items(Joi.string().uri()).optional(),
  service_notes: Joi.string().max(2000).allow(null, "").optional(),
  pet_behavior_observed: Joi.string().max(1000).allow(null, "").optional(),
  health_observations: Joi.string().max(1000).allow(null, "").optional(),
  concerns_flagged: Joi.string().max(1000).allow(null, "").optional(),
  products_used: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        quantity: Joi.string().optional(),
      })
    )
    .optional(),
  additional_services_recommended: Joi.string()
    .max(1000)
    .allow(null, "")
    .optional(),
  next_visit_suggestions: Joi.string().max(1000).allow(null, "").optional(),
});

const setAvailabilitySchema = Joi.object({
  date: Joi.date().min("now").required().messages({
    "date.min": "Date must be today or in the future",
    "any.required": "Date is required",
  }),
  start_time: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      "string.pattern.base": "Start time must be in HH:MM format",
      "any.required": "Start time is required",
    }),
  end_time: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      "string.pattern.base": "End time must be in HH:MM format",
      "any.required": "End time is required",
    }),
  is_available: Joi.boolean().default(true),
  unavailability_reason: Joi.string()
    .valid("leave", "sick", "training", "other")
    .allow(null, "")
    .optional(),
  max_bookings: Joi.number().integer().min(1).max(20).default(8).optional(),
  notes: Joi.string().max(500).allow(null, "").optional(),
});

const updateAvailabilitySchema = Joi.object({
  start_time: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional(),
  end_time: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional(),
  is_available: Joi.boolean().optional(),
  unavailability_reason: Joi.string()
    .valid("leave", "sick", "training", "other")
    .allow(null, "")
    .optional(),
  max_bookings: Joi.number().integer().min(1).max(20).optional(),
  notes: Joi.string().max(500).allow(null, "").optional(),
}).min(1);

// ==================== CARE MANAGER VALIDATION SCHEMAS ====================

const updateCareManagerProfileSchema = Joi.object({
  full_name: Joi.string().min(2).max(255).trim().optional(),
  email: Joi.string().email().lowercase().trim().optional(),
  specialization: Joi.string().max(500).allow(null, "").optional(),
  qualifications: Joi.string().max(1000).allow(null, "").optional(),
  experience_years: Joi.number()
    .integer()
    .min(0)
    .max(50)
    .allow(null)
    .optional(),
  languages_spoken: Joi.array().items(Joi.string()).allow(null).optional(),
});

const completeOnboardingSchema = Joi.object({
  notes: Joi.string().max(2000).allow(null, "").optional(),
  care_plan_url: Joi.string().uri().allow(null, "").optional(),
});

const updateCheckInFrequencySchema = Joi.object({
  check_in_frequency: Joi.string()
    .valid("daily", "weekly", "biweekly", "monthly")
    .required()
    .messages({
      "any.only":
        "Check-in frequency must be daily, weekly, biweekly, or monthly",
      "any.required": "Check-in frequency is required",
    }),
});

const logInteractionSchema = Joi.object({
  interaction_type: Joi.string()
    .valid(
      "phone_call",
      "video_call",
      "message",
      "visit",
      "emergency",
      "check_in"
    )
    .required()
    .messages({
      "any.only": "Invalid interaction type",
      "any.required": "Interaction type is required",
    }),
  interaction_date: Joi.date().max("now").optional().messages({
    "date.max": "Interaction date cannot be in the future",
  }),
  duration_minutes: Joi.number()
    .integer()
    .min(0)
    .max(480)
    .allow(null)
    .optional()
    .messages({
      "number.min": "Duration cannot be negative",
      "number.max": "Duration seems too long (max 8 hours)",
    }),
  summary: Joi.string().min(10).max(2000).required().messages({
    "string.min": "Summary must be at least 10 characters",
    "string.max": "Summary must not exceed 2000 characters",
    "any.required": "Summary is required",
  }),
  action_items: Joi.array()
    .items(
      Joi.object({
        item: Joi.string().required(),
        due_date: Joi.date().optional(),
        completed: Joi.boolean().default(false),
      })
    )
    .optional(),
  next_follow_up_date: Joi.date().min("now").allow(null).optional().messages({
    "date.min": "Follow-up date must be in the future",
  }),
});

const updateInteractionSchema = Joi.object({
  interaction_type: Joi.string()
    .valid(
      "phone_call",
      "video_call",
      "message",
      "visit",
      "emergency",
      "check_in"
    )
    .optional(),
  interaction_date: Joi.date().max("now").optional(),
  duration_minutes: Joi.number()
    .integer()
    .min(0)
    .max(480)
    .allow(null)
    .optional(),
  summary: Joi.string().min(10).max(2000).optional(),
  action_items: Joi.array()
    .items(
      Joi.object({
        item: Joi.string().required(),
        due_date: Joi.date().optional(),
        completed: Joi.boolean().default(false),
      })
    )
    .optional(),
  next_follow_up_date: Joi.date().min("now").allow(null).optional(),
}).min(1);

const scheduleCheckInSchema = Joi.object({
  next_check_in_date: Joi.date().min("now").required().messages({
    "date.min": "Check-in date must be in the future",
    "any.required": "Check-in date is required",
  }),
});

// ==================== TRACKING VALIDATION SCHEMAS ====================

const startTrackingSessionSchema = Joi.object({
  booking_id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'Invalid booking ID format',
      'any.required': 'Booking ID is required'
    }),
  pet_id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'Invalid pet ID format',
      'any.required': 'Pet ID is required'
    }),
  session_type: Joi.string()
    .valid('service_tracking', 'continuous_tracking')
    .default('service_tracking')
    .messages({
      'any.only': 'Session type must be either service_tracking or continuous_tracking'
    })
});

const updateLocationSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required()
    .messages({
      'number.base': 'Latitude must be a number',
      'number.min': 'Latitude must be between -90 and 90',
      'number.max': 'Latitude must be between -90 and 90',
      'any.required': 'Latitude is required'
    }),
  longitude: Joi.number().min(-180).max(180).required()
    .messages({
      'number.base': 'Longitude must be a number',
      'number.min': 'Longitude must be between -180 and 180',
      'number.max': 'Longitude must be between -180 and 180',
      'any.required': 'Longitude is required'
    }),
  accuracy: Joi.number().positive().allow(null).optional()
    .messages({
      'number.positive': 'Accuracy must be positive'
    }),
  altitude: Joi.number().allow(null).optional(),
  speed: Joi.number().min(0).max(200).allow(null).optional()
    .messages({
      'number.min': 'Speed cannot be negative',
      'number.max': 'Speed seems unrealistic (max 200 km/h)'
    }),
  heading: Joi.number().min(0).max(360).allow(null).optional()
    .messages({
      'number.min': 'Heading must be between 0 and 360',
      'number.max': 'Heading must be between 0 and 360'
    }),
  battery_level: Joi.number().integer().min(0).max(100).allow(null).optional()
    .messages({
      'number.min': 'Battery level must be between 0 and 100',
      'number.max': 'Battery level must be between 0 and 100'
    })
});

const calculateETASchema = Joi.object({
  destination_lat: Joi.number().min(-90).max(90).required()
    .messages({
      'number.base': 'Destination latitude must be a number',
      'number.min': 'Destination latitude must be between -90 and 90',
      'number.max': 'Destination latitude must be between -90 and 90',
      'any.required': 'Destination latitude is required'
    }),
  destination_lng: Joi.number().min(-180).max(180).required()
    .messages({
      'number.base': 'Destination longitude must be a number',
      'number.min': 'Destination longitude must be between -180 and 180',
      'number.max': 'Destination longitude must be between -180 and 180',
      'any.required': 'Destination longitude is required'
    })
});

// ==================== NOTIFICATION VALIDATION SCHEMAS ====================

const updateNotificationPreferencesSchema = Joi.object({
  booking_confirmations: Joi.boolean().optional(),
  booking_reminders: Joi.boolean().optional(),
  health_reminders: Joi.boolean().optional(),
  vaccination_reminders: Joi.boolean().optional(),
  medication_reminders: Joi.boolean().optional(),
  subscription_updates: Joi.boolean().optional(),
  payment_alerts: Joi.boolean().optional(),
  promotional: Joi.boolean().optional(),
  community_events: Joi.boolean().optional(),
  care_manager_updates: Joi.boolean().optional(),
  sms_enabled: Joi.boolean().optional(),
  email_enabled: Joi.boolean().optional(),
  push_enabled: Joi.boolean().optional(),
  whatsapp_enabled: Joi.boolean().optional(),
  quiet_hours_start: Joi.string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .allow(null, '')
    .optional()
    .messages({
      'string.pattern.base': 'Quiet hours start must be in HH:MM format (24-hour)'
    }),
  quiet_hours_end: Joi.string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .allow(null, '')
    .optional()
    .messages({
      'string.pattern.base': 'Quiet hours end must be in HH:MM format (24-hour)'
    })
}).min(1);

const sendNotificationSchema = Joi.object({
  user_id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'Invalid user ID format',
      'any.required': 'User ID is required'
    }),
  notification_type: Joi.string()
    .valid(
      'booking_confirmation', 'booking_reminder', 'health_reminder',
      'vaccination_reminder', 'medication_reminder', 'subscription_update',
      'payment_alert', 'promo', 'update', 'community_event',
      'care_manager_update', 'emergency'
    )
    .required()
    .messages({
      'any.only': 'Invalid notification type',
      'any.required': 'Notification type is required'
    }),
  priority: Joi.string()
    .valid('low', 'normal', 'high', 'urgent')
    .default('normal')
    .optional(),
  title: Joi.string().min(1).max(255).required()
    .messages({
      'string.empty': 'Title is required',
      'string.max': 'Title must not exceed 255 characters',
      'any.required': 'Title is required'
    }),
  message: Joi.string().min(1).max(1000).required()
    .messages({
      'string.empty': 'Message is required',
      'string.max': 'Message must not exceed 1000 characters',
      'any.required': 'Message is required'
    }),
  rich_content: Joi.object().allow(null).optional(),
  action_type: Joi.string()
    .valid('open_booking', 'open_subscription', 'open_pet', 'open_url', 'none')
    .allow(null, '')
    .optional(),
  action_url: Joi.string().uri().allow(null, '').optional(),
  action_data: Joi.object().allow(null).optional(),
  delivery_method: Joi.string()
    .valid('push', 'sms', 'email', 'whatsapp', 'in_app')
    .default('push')
    .optional(),
  expires_at: Joi.date().min('now').allow(null).optional()
    .messages({
      'date.min': 'Expiry date must be in the future'
    })
});

const sendTemplateNotificationSchema = Joi.object({
  user_id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'Invalid user ID format',
      'any.required': 'User ID is required'
    }),
  template_code: Joi.string().min(1).max(50).required()
    .messages({
      'string.empty': 'Template code is required',
      'string.max': 'Template code too long',
      'any.required': 'Template code is required'
    }),
  variables: Joi.object().default({}).optional()
    .messages({
      'object.base': 'Variables must be an object'
    }),
  delivery_method: Joi.string()
    .valid('push', 'sms', 'email', 'whatsapp', 'in_app')
    .default('push')
    .optional()
});

const sendBulkNotificationsSchema = Joi.object({
  user_ids: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .max(1000)
    .required()
    .messages({
      'array.base': 'user_ids must be an array',
      'array.min': 'At least one user ID is required',
      'array.max': 'Cannot send to more than 1000 users at once',
      'any.required': 'user_ids is required'
    }),
  notification_type: Joi.string()
    .valid(
      'booking_confirmation', 'booking_reminder', 'health_reminder',
      'vaccination_reminder', 'medication_reminder', 'subscription_update',
      'payment_alert', 'promo', 'update', 'community_event',
      'care_manager_update', 'emergency'
    )
    .required()
    .messages({
      'any.only': 'Invalid notification type',
      'any.required': 'Notification type is required'
    }),
  priority: Joi.string()
    .valid('low', 'normal', 'high', 'urgent')
    .default('normal')
    .optional(),
  title: Joi.string().min(1).max(255).required()
    .messages({
      'string.empty': 'Title is required',
      'any.required': 'Title is required'
    }),
  message: Joi.string().min(1).max(1000).required()
    .messages({
      'string.empty': 'Message is required',
      'any.required': 'Message is required'
    }),
  delivery_method: Joi.string()
    .valid('push', 'sms', 'email', 'whatsapp', 'in_app')
    .default('push')
    .optional()
});

// ==================== COMMUNITY EVENT SCHEMAS ====================

const registerForEventSchema = Joi.object({
  pet_id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'Invalid pet ID format',
      'any.required': 'Pet ID is required'
    }),
  special_requirements: Joi.string().max(500).allow(null, '').optional()
    .messages({
      'string.max': 'Special requirements too long (max 500 characters)'
    }),
  emergency_contact_name: Joi.string().max(255).allow(null, '').optional()
    .messages({
      'string.max': 'Emergency contact name too long'
    }),
  emergency_contact_phone: Joi.string()
    .pattern(/^(\+91)?[6-9]\d{9}$/)
    .allow(null, '')
    .optional()
    .messages({
      'string.pattern.base': 'Invalid phone number format'
    })
});

const cancelEventRegistrationSchema = Joi.object({
  cancellation_reason: Joi.string().min(5).max(500).required()
    .messages({
      'string.empty': 'Cancellation reason is required',
      'string.min': 'Reason must be at least 5 characters',
      'string.max': 'Reason too long (max 500 characters)',
      'any.required': 'Cancellation reason is required'
    })
});

const submitEventFeedbackSchema = Joi.object({
  feedback_rating: Joi.number().integer().min(1).max(5).required()
    .messages({
      'number.base': 'Rating must be a number',
      'number.min': 'Rating must be between 1 and 5',
      'number.max': 'Rating must be between 1 and 5',
      'any.required': 'Rating is required'
    }),
  feedback_text: Joi.string().max(1000).allow(null, '').optional()
    .messages({
      'string.max': 'Feedback too long (max 1000 characters)'
    })
});

const joinWaitlistSchema = Joi.object({
  pet_id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'Invalid pet ID format',
      'any.required': 'Pet ID is required'
    }),
  special_requirements: Joi.string().max(500).allow(null, '').optional()
    .messages({
      'string.max': 'Special requirements too long (max 500 characters)'
    })
});

// ==================== SUPPORT TICKET SCHEMAS ====================

const createTicketSchema = Joi.object({
  subject: Joi.string().min(5).max(255).required()
    .messages({
      'string.empty': 'Subject is required',
      'string.min': 'Subject must be at least 5 characters',
      'string.max': 'Subject too long (max 255 characters)',
      'any.required': 'Subject is required'
    }),
  description: Joi.string().min(10).max(5000).required()
    .messages({
      'string.empty': 'Description is required',
      'string.min': 'Description must be at least 10 characters',
      'string.max': 'Description too long (max 5000 characters)',
      'any.required': 'Description is required'
    }),
  category: Joi.string()
    .valid('technical', 'billing', 'service_quality', 'complaint', 'inquiry', 'feedback')
    .required()
    .messages({
      'any.only': 'Invalid category',
      'any.required': 'Category is required'
    }),
  subcategory: Joi.string().max(50).allow(null, '').optional()
    .messages({
      'string.max': 'Subcategory too long'
    }),
  priority: Joi.string()
    .valid('low', 'medium', 'high', 'urgent')
    .default('medium')
    .messages({
      'any.only': 'Invalid priority level'
    }),
  channel: Joi.string()
    .valid('app', 'email', 'phone', 'chat', 'whatsapp')
    .default('app')
    .messages({
      'any.only': 'Invalid channel'
    }),
  booking_id: Joi.string().uuid().allow(null).optional()
    .messages({
      'string.guid': 'Invalid booking ID format'
    }),
  subscription_id: Joi.string().uuid().allow(null).optional()
    .messages({
      'string.guid': 'Invalid subscription ID format'
    }),
  pet_id: Joi.string().uuid().allow(null).optional()
    .messages({
      'string.guid': 'Invalid pet ID format'
    }),
  attachments: Joi.array()
    .items(Joi.string().uri())
    .max(5)
    .allow(null)
    .optional()
    .messages({
      'array.max': 'Maximum 5 attachments allowed'
    })
});

const addTicketMessageSchema = Joi.object({
  message: Joi.string().min(1).max(5000).required()
    .messages({
      'string.empty': 'Message is required',
      'string.max': 'Message too long (max 5000 characters)',
      'any.required': 'Message is required'
    }),
  attachments: Joi.array()
    .items(Joi.string().uri())
    .max(5)
    .allow(null)
    .optional()
    .messages({
      'array.max': 'Maximum 5 attachments allowed'
    })
});

const closeTicketSchema = Joi.object({
  customer_satisfaction_rating: Joi.number().integer().min(1).max(5).optional()
    .messages({
      'number.base': 'Rating must be a number',
      'number.min': 'Rating must be between 1 and 5',
      'number.max': 'Rating must be between 1 and 5'
    }),
  customer_feedback: Joi.string().max(1000).allow(null, '').optional()
    .messages({
      'string.max': 'Feedback too long (max 1000 characters)'
    })
});

const reopenTicketSchema = Joi.object({
  reason: Joi.string().min(10).max(500).required()
    .messages({
      'string.empty': 'Reason is required',
      'string.min': 'Reason must be at least 10 characters',
      'string.max': 'Reason too long (max 500 characters)',
      'any.required': 'Reason for reopening is required'
    })
});


// ==================== PRICING RULES ====================

const createPricingRuleSchema = Joi.object({
  rule_name: Joi.string().min(1).max(255).required()
    .messages({
      'string.empty': 'Rule name is required',
      'any.required': 'Rule name is required'
    }),
  service_id: Joi.string().uuid().optional().allow(null),
  tier_id: Joi.number().integer().min(1).max(3).optional().allow(null),
  species_id: Joi.number().integer().positive().optional().allow(null),
  life_stage_id: Joi.number().integer().positive().optional().allow(null),
  location_type_id: Joi.number().integer().positive().optional().allow(null),
  price_modifier: Joi.number().allow(null).optional(),
  modifier_type: Joi.string().valid('percentage', 'fixed_amount').optional().allow(null),
  day_of_week: Joi.number().integer().min(0).max(6).optional().allow(null),
  time_start: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().allow(null),
  time_end: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().allow(null),
  min_booking_value: Joi.number().positive().optional().allow(null),
  max_booking_value: Joi.number().positive().optional().allow(null),
  priority: Joi.number().integer().min(0).default(0),
  valid_from: Joi.date().optional().allow(null),
  valid_until: Joi.date().min(Joi.ref('valid_from')).optional().allow(null),
  description: Joi.string().allow(null, '').optional()
});

const updatePricingRuleSchema = Joi.object({
  rule_name: Joi.string().min(1).max(255).optional(),
  service_id: Joi.string().uuid().optional().allow(null),
  tier_id: Joi.number().integer().min(1).max(3).optional().allow(null),
  species_id: Joi.number().integer().positive().optional().allow(null),
  life_stage_id: Joi.number().integer().positive().optional().allow(null),
  location_type_id: Joi.number().integer().positive().optional().allow(null),
  price_modifier: Joi.number().allow(null).optional(),
  modifier_type: Joi.string().valid('percentage', 'fixed_amount').optional().allow(null),
  day_of_week: Joi.number().integer().min(0).max(6).optional().allow(null),
  time_start: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().allow(null),
  time_end: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().allow(null),
  min_booking_value: Joi.number().positive().optional().allow(null),
  max_booking_value: Joi.number().positive().optional().allow(null),
  is_active: Joi.boolean().optional(),
  priority: Joi.number().integer().min(0).optional(),
  valid_from: Joi.date().optional().allow(null),
  valid_until: Joi.date().optional().allow(null),
  description: Joi.string().allow(null, '').optional()
}).min(1);

// ==================== FAIR USAGE POLICIES ====================

const createFairUsagePolicySchema = Joi.object({
  tier_id: Joi.number().integer().min(1).max(3).required()
    .messages({
      'any.required': 'Tier ID is required'
    }),
  category_id: Joi.number().integer().positive().required()
    .messages({
      'any.required': 'Category ID is required'
    }),
  max_usage_per_month: Joi.number().integer().positive().optional().allow(null),
  max_usage_per_week: Joi.number().integer().positive().optional().allow(null),
  max_usage_per_day: Joi.number().integer().positive().optional().allow(null),
  cooldown_period_days: Joi.number().integer().positive().optional().allow(null),
  cooldown_period_hours: Joi.number().integer().positive().optional().allow(null),
  abuse_threshold: Joi.number().integer().positive().optional().allow(null),
  abuse_action: Joi.string().valid('warn', 'block', 'manual_review').optional().allow(null),
  description: Joi.string().allow(null, '').optional()
});

const updateFairUsagePolicySchema = Joi.object({
  max_usage_per_month: Joi.number().integer().positive().optional().allow(null),
  max_usage_per_week: Joi.number().integer().positive().optional().allow(null),
  max_usage_per_day: Joi.number().integer().positive().optional().allow(null),
  cooldown_period_days: Joi.number().integer().positive().optional().allow(null),
  cooldown_period_hours: Joi.number().integer().positive().optional().allow(null),
  abuse_threshold: Joi.number().integer().positive().optional().allow(null),
  abuse_action: Joi.string().valid('warn', 'block', 'manual_review').optional().allow(null),
  description: Joi.string().allow(null, '').optional(),
  is_active: Joi.boolean().optional()
}).min(1);

// ==================== PROMO CODES ====================

const createPromoCodeSchema = Joi.object({
  promo_code: Joi.string().uppercase().min(3).max(50).required()
    .messages({
      'string.empty': 'Promo code is required',
      'any.required': 'Promo code is required'
    }),
  promo_name: Joi.string().min(1).max(255).required()
    .messages({
      'string.empty': 'Promo name is required',
      'any.required': 'Promo name is required'
    }),
  description: Joi.string().allow(null, '').optional(),
  discount_type: Joi.string().valid('percentage', 'fixed_amount').required()
    .messages({
      'any.only': 'Discount type must be percentage or fixed_amount',
      'any.required': 'Discount type is required'
    }),
  discount_value: Joi.number().positive().required()
    .messages({
      'number.positive': 'Discount value must be positive',
      'any.required': 'Discount value is required'
    }),
  max_discount_amount: Joi.number().positive().optional().allow(null),
  min_purchase_amount: Joi.number().positive().optional().allow(null),
  applicable_to: Joi.string().valid('all', 'subscription', 'service').default('all'),
  tier_ids: Joi.array().items(Joi.number().integer().positive()).optional().allow(null),
  service_ids: Joi.array().items(Joi.string().uuid()).optional().allow(null),
  max_uses_total: Joi.number().integer().positive().optional().allow(null),
  max_uses_per_user: Joi.number().integer().positive().default(1),
  valid_from: Joi.date().required()
    .messages({
      'any.required': 'Valid from date is required'
    }),
  valid_until: Joi.date().min(Joi.ref('valid_from')).required()
    .messages({
      'date.min': 'Valid until must be after valid from date',
      'any.required': 'Valid until date is required'
    })
});

const updatePromoCodeSchema = Joi.object({
  promo_name: Joi.string().min(1).max(255).optional(),
  description: Joi.string().allow(null, '').optional(),
  discount_type: Joi.string().valid('percentage', 'fixed_amount').optional(),
  discount_value: Joi.number().positive().optional(),
  max_discount_amount: Joi.number().positive().optional().allow(null),
  min_purchase_amount: Joi.number().positive().optional().allow(null),
  applicable_to: Joi.string().valid('all', 'subscription', 'service').optional(),
  tier_ids: Joi.array().items(Joi.number().integer().positive()).optional().allow(null),
  service_ids: Joi.array().items(Joi.string().uuid()).optional().allow(null),
  max_uses_total: Joi.number().integer().positive().optional().allow(null),
  max_uses_per_user: Joi.number().integer().positive().optional(),
  is_active: Joi.boolean().optional(),
  valid_from: Joi.date().optional(),
  valid_until: Joi.date().optional()
}).min(1);

const validatePromoCodeSchemaForUser = Joi.object({
  promo_code: Joi.string().uppercase().min(3).max(50).required()
    .messages({
      'string.empty': 'Promo code is required',
      'any.required': 'Promo code is required'
    }),
  tier_id: Joi.number().integer().min(1).max(3).optional().allow(null),
  service_id: Joi.string().uuid().optional().allow(null),
  amount: Joi.number().positive().required()
    .messages({
      'number.positive': 'Amount must be positive',
      'any.required': 'Amount is required'
    })
});

// ==================== APP SETTINGS ====================

const upsertSettingSchema = Joi.object({
  setting_key: Joi.string().min(1).max(100).required()
    .messages({
      'string.empty': 'Setting key is required',
      'any.required': 'Setting key is required'
    }),
  setting_value: Joi.alternatives().try(
    Joi.string(),
    Joi.number(),
    Joi.boolean(),
    Joi.object()
  ).required()
    .messages({
      'any.required': 'Setting value is required'
    }),
  setting_type: Joi.string().valid('string', 'number', 'boolean', 'json').default('string'),
  category: Joi.string().max(50).default('general'),
  description: Joi.string().allow(null, '').optional(),
  is_public: Joi.boolean().default(false)
});

// ==================== SYSTEM ALERTS ====================

const createAlertSchema = Joi.object({
  alert_type: Joi.string().valid('maintenance', 'outage', 'feature_launch', 'urgent').required()
    .messages({
      'any.only': 'Invalid alert type',
      'any.required': 'Alert type is required'
    }),
  title: Joi.string().min(1).max(255).required()
    .messages({
      'string.empty': 'Title is required',
      'any.required': 'Title is required'
    }),
  message: Joi.string().min(1).required()
    .messages({
      'string.empty': 'Message is required',
      'any.required': 'Message is required'
    }),
  severity: Joi.string().valid('info', 'warning', 'critical').default('info'),
  display_location: Joi.string().valid('banner', 'modal', 'notification').default('banner'),
  target_audience: Joi.string().valid('all', 'customers', 'caregivers', 'admins').default('all'),
  start_time: Joi.date().required()
    .messages({
      'any.required': 'Start time is required'
    }),
  end_time: Joi.date().min(Joi.ref('start_time')).optional().allow(null)
    .messages({
      'date.min': 'End time must be after start time'
    })
});

// ==================== ANALYTICS ====================

const trackEventSchema = Joi.object({
  event_type: Joi.string().valid(
    'page_view', 'button_click', 'service_view', 'search',
    'booking_start', 'booking_complete', 'signup', 'login'
  ).required()
    .messages({
      'any.only': 'Invalid event type',
      'any.required': 'Event type is required'
    }),
  event_name: Joi.string().max(100).optional().allow(null),
  page_url: Joi.string().uri().optional().allow(null),
  referrer_url: Joi.string().uri().optional().allow(null),
  event_data: Joi.object().optional().allow(null),
  device_type: Joi.string().valid('mobile', 'tablet', 'desktop').optional().allow(null),
  browser: Joi.string().max(50).optional().allow(null),
  os: Joi.string().max(50).optional().allow(null)
});



module.exports = {
  updateProfileSchema,
  createAddressSchema,
  updateAddressSchema,
  updatePreferencesSchema,
  // updateNotificationPreferencesSchema,
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
  updateGrowthRecordSchema,

  // Subscription schemas
  createSubscriptionSchema,
  upgradeSubscriptionSchema,
  downgradeSubscriptionSchema,
  pauseSubscriptionSchema,
  cancelSubscriptionSchema,
  toggleAutoRenewalSchema,
  validatePromoCodeSchema,
  calculatePriceSchema,

  // Payment schemas
  addPaymentMethodSchema,
  processPaymentSchema,
  verifyPaymentSchema,
  requestRefundSchema,
  createInvoiceSchema,
  applyPromoCodeSchema,

  // service booking schemas
  createBookingSchema,
  cancelBookingSchema,
  rescheduleBookingSchema,
  calculateBookingPriceSchema,

  // Caregiver schemas
  updateCaregiverProfileSchema,
  addSpecializationSchema,
  rejectAssignmentSchema,
  startServiceSchema,
  completeServiceSchema,
  setAvailabilitySchema,
  updateAvailabilitySchema,

  // Care Manager schemas
  updateCareManagerProfileSchema,
  completeOnboardingSchema,
  updateCheckInFrequencySchema,
  logInteractionSchema,
  updateInteractionSchema,
  scheduleCheckInSchema,

  // Tracking schemas
  startTrackingSessionSchema,
  updateLocationSchema,
  calculateETASchema,
  
  // Notification schemas
  updateNotificationPreferencesSchema,
  sendNotificationSchema,
  sendTemplateNotificationSchema,
  sendBulkNotificationsSchema,

  // Community event schemas
  registerForEventSchema,
  cancelEventRegistrationSchema,
  submitEventFeedbackSchema,
  joinWaitlistSchema,
  
  // Support ticket schemas
  createTicketSchema,
  addTicketMessageSchema,
  closeTicketSchema,
  reopenTicketSchema,

    // Pricing rules
  createPricingRuleSchema,
  updatePricingRuleSchema,

  // Fair usage
  createFairUsagePolicySchema,
  updateFairUsagePolicySchema,

  // Promo codes
  createPromoCodeSchema,
  updatePromoCodeSchema,
  validatePromoCodeSchemaForUser,

  // Settings
  upsertSettingSchema,

  // Alerts
  createAlertSchema,

  // Analytics
  trackEventSchema
};
