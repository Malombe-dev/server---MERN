const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail', // or your preferred email service
      auth: {
        user: process.env.EMAIL_FROM,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  // Send welcome email to new volunteers
  async sendWelcomeEmail(volunteer) {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: volunteer.email,
      subject: 'Welcome to the 2027 Campaign Team!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1e3a8a, #3b82f6); color: white; padding: 20px; text-align: center;">
            <h1>Welcome to Our Campaign!</h1>
            <h2>Reset. Restore. Rebuild.</h2>
          </div>
          
          <div style="padding: 20px; background: #f8fafc;">
            <h3>Hello ${volunteer.firstName} ${volunteer.lastName},</h3>
            
            <p>Thank you for joining our 2027 Presidential Campaign team! Your commitment to positive change in Kenya is truly inspiring.</p>
            
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4>Your Registration Details:</h4>
              <ul>
                <li><strong>Name:</strong> ${volunteer.firstName} ${volunteer.lastName}</li>
                <li><strong>County:</strong> ${volunteer.county}</li>
                <li><strong>Constituency:</strong> ${volunteer.constituency}</li>
                <li><strong>Skills:</strong> ${volunteer.skills.join(', ')}</li>
                <li><strong>Availability:</strong> ${volunteer.availability}</li>
              </ul>
            </div>
            
            <p>What happens next:</p>
            <ol>
              <li>You'll receive updates about campaign activities in your area</li>
              <li>Local coordinators will reach out with volunteer opportunities</li>
              <li>You'll get exclusive access to campaign materials and resources</li>
            </ol>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/join" 
                 style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Visit Campaign Dashboard
              </a>
            </div>
            
            <p>Together, we will Reset our democracy, Restore our values, and Rebuild our nation.</p>
            
            <p>Best regards,<br>
            <strong>The 2027 Campaign Team</strong></p>
          </div>
          
          <div style="background: #1f2937; color: #9ca3af; padding: 15px; text-align: center; font-size: 12px;">
            <p>© 2027 Presidential Campaign. All rights reserved.</p>
            <p>If you no longer wish to receive these emails, you can unsubscribe at any time.</p>
          </div>
        </div>
      `
    };

    return await this.transporter.sendMail(mailOptions);
  }

  // Send contact form confirmation
  async sendContactConfirmation(contact) {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: contact.email,
      subject: 'We received your message - 2027 Campaign',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1e3a8a; color: white; padding: 20px; text-align: center;">
            <h1>Message Received</h1>
          </div>
          
          <div style="padding: 20px;">
            <h3>Hello ${contact.name},</h3>
            
            <p>Thank you for reaching out to our campaign. We have received your message and will respond within 24-48 hours.</p>
            
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4>Your Message:</h4>
              <p><strong>Subject:</strong> ${contact.subject}</p>
              <p><strong>Category:</strong> ${contact.category}</p>
              <p><strong>Message:</strong> ${contact.message}</p>
            </div>
            
            <p>In the meantime, feel free to:</p>
            <ul>
              <li>Follow us on social media for the latest updates</li>
              <li>Explore our policies and vision at our website</li>
              <li>Join our volunteer team if you haven't already</li>
            </ul>
            
            <p>Best regards,<br>
            <strong>The 2027 Campaign Team</strong></p>
          </div>
        </div>
      `
    };

    return await this.transporter.sendMail(mailOptions);
  }

  // Send press release notification
  async sendPressNotification(pressRelease, subscribers) {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      bcc: subscribers.map(sub => sub.email),
      subject: `New Press Release: ${pressRelease.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1e3a8a; color: white; padding: 20px; text-align: center;">
            <h1>Latest Press Release</h1>
          </div>
          
          <div style="padding: 20px;">
            <h2>${pressRelease.title}</h2>
            <p style="color: #6b7280; margin-bottom: 20px;">
              ${new Date(pressRelease.publishDate).toLocaleDateString('en-KE', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
            
            <div style="line-height: 1.6;">
              ${pressRelease.content.substring(0, 300)}...
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/press/${pressRelease._id}" 
                 style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Read Full Press Release
              </a>
            </div>
          </div>
        </div>
      `
    };

    return await this.transporter.sendMail(mailOptions);
  }

  // Send event reminder
  async sendEventReminder(event, attendees) {
    const eventDate = new Date(event.date);
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      bcc: attendees.map(att => att.email),
      subject: `Reminder: ${event.title} - Tomorrow`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #dc2626; color: white; padding: 20px; text-align: center;">
            <h1>Event Reminder</h1>
          </div>
          
          <div style="padding: 20px;">
            <h2>${event.title}</h2>
            
            <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
              <p><strong>⏰ This event is happening tomorrow!</strong></p>
            </div>
            
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
              <h4>Event Details:</h4>
              <ul>
                <li><strong>Date:</strong> ${eventDate.toLocaleDateString('en-KE', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</li>
                <li><strong>Time:</strong> ${eventDate.toLocaleTimeString('en-KE', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}</li>
                <li><strong>Location:</strong> ${event.location}</li>
                <li><strong>County:</strong> ${event.county}</li>
              </ul>
            </div>
            
            <p>${event.description}</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/events/${event._id}" 
                 style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Event Details
              </a>
            </div>
            
            <p>See you there!</p>
            
            <p>Best regards,<br>
            <strong>The 2027 Campaign Team</strong></p>
          </div>
        </div>
      `
    };

    return await this.transporter.sendMail(mailOptions);
  }

  // Send newsletter
  async sendNewsletter(newsletter, subscribers) {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      bcc: subscribers.map(sub => sub.email),
      subject: newsletter.subject,
      html: newsletter.content
    };

    return await this.transporter.sendMail(mailOptions);
  }
}

module.exports = new EmailService();