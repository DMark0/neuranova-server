const dns = require('dns');
dns.setDefaultResultOrder('ipv4first'); // 1. Fixes the 20-second connection timeout (MUST be line 1) [1]

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for your local Angular app
app.use(cors({
    origin: process.env.ALLOWED_ORIGIN || 'http://localhost:4200'
}));

app.use(express.json());

// Set up in-memory file processing (no disk writes)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

// Configure standard Gmail Service connection
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

app.post('/api/contact', upload.single('resume'), async (req, res) => {
    try {
        const payload = req.body;
        const file = req.file;

        const selectedTopic = payload.selectedTopic || 'General Inquiry';
        const fullName = payload.fullName || 'Anonymous';

        let emailBody = `New Medical Concierge Inquiry received.\n\n`;
        emailBody += `Topic: ${selectedTopic.toUpperCase()}\n`;
        emailBody += `Name: ${fullName}\n`;
        emailBody += `Email: ${payload.email}\n`;
        emailBody += `Phone: ${payload.phone}\n\n`;

        // Map out non-standard form fields
        Object.keys(payload).forEach(key => {
            if (!['fullName', 'email', 'phone', 'selectedTopic', 'resume', '_subject'].includes(key)) {
                emailBody += `${key}: ${payload[key]}\n`;
            }
        });

        const mailOptions = {
            // Prevents Gmail spam-flagging (authenticator matches "from")
            from: `"${fullName}" <${process.env.SMTP_USER}>`,

            // Allows you to reply directly to the person who filled out the form
            replyTo: payload.email,

            // Directs the email to your recipient email, falling back to SMTP_USER if undefined
            to: process.env.RECIPIENT_EMAIL || process.env.SMTP_USER,

            subject: `New Submission: ${fullName} (${selectedTopic})`,
            text: emailBody
        };

        // Attach PDF resume if present
        if (file) {
            mailOptions.attachments = [{
                filename: file.originalname,
                content: file.buffer
            }];
        }

        await transporter.sendMail(mailOptions);

        res.status(200).json({ success: true, message: 'Email sent successfully.' });
    } catch (error) {
        console.error('Email delivery error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`Node.js/Express server is running on http://localhost:${PORT}`);
});