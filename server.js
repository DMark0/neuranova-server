const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Resend } = require('resend');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const resend = new Resend(process.env.RESEND_API_KEY);

app.use(cors({
    origin: [
        process.env.ALLOWED_ORIGIN,
        'http://localhost:4200'
    ]
}));

app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }
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

        Object.keys(payload).forEach(key => {
            if (!['fullName', 'email', 'phone', 'selectedTopic', 'resume', '_subject'].includes(key)) {
                emailBody += `${key}: ${payload[key]}\n`;
            }
        });

        const mailOptions = {
            from: process.env.SENDER_EMAIL,        // e.g. 'Neuranova <noreply@neuranova.com>'
            replyTo: payload.email,
            to: process.env.RECIPIENT_EMAIL,
            subject: `New Submission: ${fullName} (${selectedTopic})`,
            text: emailBody,
        };

        // Attach PDF resume if present
        if (file) {
            mailOptions.attachments = [{
                filename: file.originalname,
                content: file.buffer,              // Resend accepts Buffer directly
            }];
        }

        await resend.emails.send(mailOptions);

        res.status(200).json({ success: true, message: 'Email sent successfully.' });
    } catch (error) {
        console.error('Email delivery error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});