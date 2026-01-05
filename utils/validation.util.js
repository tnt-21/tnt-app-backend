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

module.exports = {
  updateProfileSchema,
  createAddressSchema,
  updateAddressSchema,
  updatePreferencesSchema,
  updateNotificationPreferencesSchema,
  updatePhoneSchema,
  updateEmailSchema
};