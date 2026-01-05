// ============================================
// FILE: services/sms.service.js
// SMS Provider Integration
// ============================================

const axios = require('axios');

class SMSService {
  constructor() {
    this.provider = process.env.SMS_PROVIDER || 'msg91';
    
    // MSG91 Config (India-focused, cheap)
    this.msg91AuthKey = process.env.MSG91_AUTH_KEY;
    this.msg91SenderId = process.env.MSG91_SENDER_ID || 'TAILSS';
    this.msg91TemplateId = process.env.MSG91_TEMPLATE_ID;
    
    // Twilio Config (Alternative)
    this.twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    this.twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
  }

  /**
   * Send OTP via SMS
   */
  async sendOTP(phone, otp, purpose='general') {
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEV OTP] ${purpose} OTP for ${phone}: ${otp}`);
        return { otp, purpose };
      }

      if (this.provider === 'msg91') {
        return this.sendViaMSG91(phone, otp);
      } else if (this.provider === 'twilio') {
        return this.sendViaTwilio(phone, otp);
      }

      throw new Error('Invalid SMS provider configured');
    } catch (error) {
      console.error('SMS sending failed:', error);
      throw error;
    }
  }

  /**
   * MSG91 Implementation
   */
  async sendViaMSG91(phone, otp) {
    const url = `https://api.msg91.com/api/v5/otp`;
    
    const payload = {
      template_id: this.msg91TemplateId,
      mobile: phone.replace('+', ''),
      authkey: this.msg91AuthKey,
      otp: otp
    };

    const response = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    return {
      success: response.data.type === 'success',
      provider: 'msg91',
      messageId: response.data.request_id
    };
  }

  /**
   * Twilio Implementation
   */
  async sendViaTwilio(phone, otp) {
    const accountSid = this.twilioAccountSid;
    const authToken = this.twilioAuthToken;
    const client = require('twilio')(accountSid, authToken);

    const message = await client.messages.create({
      body: `Your Tails & Tales OTP is: ${otp}. Valid for 5 minutes. Do not share with anyone.`,
      from: this.twilioPhoneNumber,
      to: phone
    });

    return {
      success: message.status !== 'failed',
      provider: 'twilio',
      messageId: message.sid
    };
  }
}

module.exports = new SMSService();