import axios from 'axios';

const CRYPTOBOT_API_TOKEN = process.env.CRYPTOBOT_API_TOKEN;
const API_URL = 'https://pay.crypt.bot/api';

if (!CRYPTOBOT_API_TOKEN) {
  throw new Error('Missing CRYPTOBOT_API_TOKEN in environment');
}

interface CreateInvoiceParams {
  asset: string; // e.g., 'USDT', 'TON', 'BTC'
  amount: number;
  description?: string;
  hidden_message?: string;
  paid_btn_name?: string;
  paid_btn_url?: string;
  payload?: string;
  allow_comments?: boolean;
  allow_anonymous?: boolean;
  expires_in?: number;
}

export async function createInvoice(params: CreateInvoiceParams) {
  const res = await axios.post(
    `${API_URL}/createInvoice`,
    params,
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CRYPTOBOT_API_TOKEN}`
      }
    }
  );
  return res.data.result;
}

export async function getInvoiceStatus(invoiceId: number) {
  const res = await axios.get(
    `${API_URL}/getInvoices?invoice_ids=${invoiceId}`,
    {
      headers: {
        'Authorization': `Bearer ${CRYPTOBOT_API_TOKEN}`
      }
    }
  );
  return res.data.result[0];
} 