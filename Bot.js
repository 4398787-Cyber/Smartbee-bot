require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const FormData = require('form-data');

const client = new Client({ authStrategy: new LocalAuth() });
let smartbeeCookies = null;

client.on('qr', qr => {
    console.log('סרוק את ה-QR הזה בוואטסאפ:');
    qrcode.generate(qr, {small: true});
});
client.on('ready', () => console.log('✅ הבוט מחובר ומקשיב רק לקבוצת Smartbee'));

async function loginSmartbee() {
    try {
        const res = await axios.post('https://smartbee.co.il/api/auth/login', {
            email: process.env.SMARTBEE_EMAIL,
            password: process.env.SMARTBEE_PASSWORD
        });
        smartbeeCookies = res.headers['set-cookie'];
        console.log('התחברתי ל-Smartbee');
        return true;
    } catch(e) {
        console.log('שגיאת התחברות ל-Smartbee, מנסה דרך /login', e.message);
        // אם זה לא ה-API הנכון - נגלה מה-NETWORK שלך
        return false;
    }
}

client.on('message', async msg => {
    try {
        const chat = await msg.getChat();
        // מקשיב רק לקבוצה שקוראים לה Smartbee
        if (!chat.isGroup || chat.name !== 'Smartbee') return;
        if (!msg.hasMedia) return;

        console.log(`קיבלתי קובץ בקבוצת Smartbee מ-${msg.author || msg.from}`);

        const media = await msg.downloadMedia();
        if (!smartbeeCookies) await loginSmartbee();

        const form = new FormData();
        // השם של השדה - זה מה שאני צריך לאמת מולך: file / image / attachment
        form.append('file', Buffer.from(media.data, 'base64'), {
            filename: `expense-${Date.now()}.${media.mimetype.split('/')[1] || 'jpg'}`,
            contentType: media.mimetype
        });

        const res = await axios.post('https://smartbee.co.il/mobile/expenses/capture-expense', form, {
            headers: { ...form.getHeaders(), Cookie: smartbeeCookies?.join('; ') },
            withCredentials: true
        });

        await chat.sendMessage(`✅ הועלה ל-Smartbee בהצלחה!\nקובץ: ${media.filename || 'קבלה'}\nסטטוס: ${res.status}`);
    } catch (e) {
        console.error(e);
        const chat = await msg.getChat();
        chat.sendMessage(`❌ נכשל: ${e.response?.status} ${e.message}\nשלח לי צילום מסך מה-F12 כדי שאתקן.`);
    }
});

client.initialize();
