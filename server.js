const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Resend } = require('resend');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Startup diagnostics ---
console.log('=== SERVER STARTING ===');
console.log('PORT:', PORT);
console.log('ALLOWED_ORIGIN:', process.env.ALLOWED_ORIGIN);
console.log('SENDER_EMAIL:', process.env.SENDER_EMAIL);
console.log('RECIPIENT_EMAIL:', process.env.RECIPIENT_EMAIL);
console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY ? `set (${process.env.RESEND_API_KEY.slice(0, 8)}...)` : 'MISSING');

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
    console.log('\n=== INCOMING REQUEST ===');
    console.log('Time:', new Date().toISOString());
    console.log('Origin:', req.headers.origin);
    console.log('Content-Type:', req.headers['content-type']);

    try {
        const payload = req.body;
        const file = req.file;

        console.log('\n--- Payload ---');
        console.log('fullName:', payload.fullName);
        console.log('email:', payload.email);
        console.log('phone:', payload.phone);
        console.log('selectedTopic:', payload.selectedTopic);
        console.log('extra keys:', Object.keys(payload).filter(k =>
            !['fullName', 'email', 'phone', 'selectedTopic', 'resume', '_subject'].includes(k)
        ));
        console.log('file attached:', file ? `${file.originalname} (${file.size} bytes)` : 'none');

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
            from: process.env.SENDER_EMAIL,
            replyTo: payload.email,
            to: process.env.RECIPIENT_EMAIL,
            subject: `${selectedTopic}: ${fullName}`,
            text: emailBody,
        };

        if (file) {
            mailOptions.attachments = [{
                filename: file.originalname,
                content: file.buffer,
            }];
        }

        console.log('\n--- Resend payload ---');
        console.log('from:', mailOptions.from);
        console.log('to:', mailOptions.to);
        console.log('replyTo:', mailOptions.replyTo);
        console.log('subject:', mailOptions.subject);
        console.log('attachments:', mailOptions.attachments ? mailOptions.attachments.map(a => a.filename) : 'none');

        console.log('\n--- Calling resend.emails.send() ---');
        const result = await resend.emails.send(mailOptions);
        console.log('Resend response:', JSON.stringify(result, null, 2));

        if (result.error) {
            console.error('Resend returned an error:', result.error);
            return res.status(500).json({ success: false, message: result.error.message });
        }

        console.log('Email sent successfully. ID:', result.data?.id);
        res.status(200).json({ success: true, message: 'Email sent successfully.' });

    } catch (error) {
        console.error('\n=== EMAIL DELIVERY ERROR ===');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});