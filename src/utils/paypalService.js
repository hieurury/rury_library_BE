import axios from 'axios';

// === PayPal Configuration ===
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID?.trim();
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET?.trim();
const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox'; // 'sandbox' or 'live'
const CLIENT_URL = process.env.CLIENT_URL?.trim();

// PayPal API URLs
const PAYPAL_API_URL = PAYPAL_MODE === 'live' 
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';

// Validate configuration
if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal configuration incomplete. Please check your .env file');
}

// === Helper Functions ===

/**
 * Get PayPal OAuth2 Access Token
 */
const getAccessToken = async () => {
    try {
        const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
        
        const response = await axios.post(
            `${PAYPAL_API_URL}/v1/oauth2/token`,
            'grant_type=client_credentials',
            {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        
        return response.data.access_token;
    } catch (error) {
        console.error('❌ Error getting PayPal access token:', error.response?.data || error.message);
        throw new Error('Failed to authenticate with PayPal');
    }
};

/**
 * Convert VND to USD (PayPal requires USD)
 * Using approximate rate: 1 USD = 25,000 VND
 */
const convertVNDtoUSD = (amountVND) => {
    const rate = 25000;
    const amountUSD = amountVND / rate;
    // Round to 2 decimal places
    return Math.round(amountUSD * 100) / 100;
};

/**
 * Create PayPal Order
 * @param {string} billId - Bill ID (transaction reference)
 * @param {number} amountVND - Amount in VND
 * @param {string} description - Order description
 * @returns {Promise<{orderId: string, approvalUrl: string}>}
 */
export const createPayPalOrder = async (billId, amountVND, description) => {
    try {
        const accessToken = await getAccessToken();
        const amountUSD = convertVNDtoUSD(amountVND);
        
        // Sanitize bill ID
        const sanitizedBillId = String(billId).replace(/[^a-zA-Z0-9]/g, '');
        
        const orderData = {
            intent: 'CAPTURE',
            purchase_units: [
                {
                    reference_id: sanitizedBillId,
                    description: description || `RuryLib - Bill ${sanitizedBillId}`,
                    amount: {
                        currency_code: 'USD',
                        value: amountUSD.toFixed(2)
                    }
                }
            ],
            application_context: {
                brand_name: 'RuryLib - Library Management',
                landing_page: 'NO_PREFERENCE',
                user_action: 'PAY_NOW',
                return_url: `${CLIENT_URL}/payment/return?provider=paypal`,
                cancel_url: `${CLIENT_URL}/payment/return?provider=paypal&cancelled=true`
            }
        };
        
        const response = await axios.post(
            `${PAYPAL_API_URL}/v2/checkout/orders`,
            orderData,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        const order = response.data;
        
        // Find approval URL
        const approvalUrl = order.links.find(link => link.rel === 'approve')?.href;
        
        if (!approvalUrl) {
            throw new Error('No approval URL found in PayPal response');
        }
        
        console.log('✅ PayPal order created:', order.id);
        
        return {
            orderId: order.id,
            approvalUrl: approvalUrl,
            amountUSD: amountUSD,
            amountVND: amountVND
        };
    } catch (error) {
        console.error('❌ Error creating PayPal order:', error.response?.data || error.message);
        throw new Error('Failed to create PayPal order');
    }
};

/**
 * Capture PayPal Order (complete the payment)
 * @param {string} orderId - PayPal Order ID
 * @returns {Promise<{success: boolean, transactionId: string, amount: number}>}
 */
export const capturePayPalOrder = async (orderId) => {
    try {
        const accessToken = await getAccessToken();
        
        const response = await axios.post(
            `${PAYPAL_API_URL}/v2/checkout/orders/${orderId}/capture`,
            {},
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        const captureData = response.data;
        
        // Check if capture was successful
        if (captureData.status === 'COMPLETED') {
            const capture = captureData.purchase_units[0].payments.captures[0];
            
            console.log('✅ PayPal payment captured:', capture.id);
            
            return {
                success: true,
                transactionId: capture.id,
                amount: parseFloat(capture.amount.value),
                currency: capture.amount.currency_code,
                status: capture.status
            };
        } else {
            console.warn('⚠️ PayPal capture not completed:', captureData.status);
            return {
                success: false,
                status: captureData.status,
                message: 'Payment not completed'
            };
        }
    } catch (error) {
        console.error('❌ Error capturing PayPal order:', error.response?.data || error.message);
        throw new Error('Failed to capture PayPal payment');
    }
};

/**
 * Get Order Details
 * @param {string} orderId - PayPal Order ID
 * @returns {Promise<Object>}
 */
export const getOrderDetails = async (orderId) => {
    try {
        const accessToken = await getAccessToken();
        
        const response = await axios.get(
            `${PAYPAL_API_URL}/v2/checkout/orders/${orderId}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        return response.data;
    } catch (error) {
        console.error('❌ Error getting PayPal order details:', error.response?.data || error.message);
        throw new Error('Failed to get order details');
    }
};

/**
 * Refund PayPal Payment
 * @param {string} captureId - PayPal Capture ID (transaction ID)
 * @param {number} amountVND - Amount to refund in VND
 * @param {string} note - Refund note/reason
 * @returns {Promise<{success: boolean, refundId: string, amount: number}>}
 */
export const refundPayPalPayment = async (captureId, amountVND, note) => {
    try {
        const accessToken = await getAccessToken();
        const amountUSD = convertVNDtoUSD(amountVND);
        
        const refundData = {
            amount: {
                currency_code: 'USD',
                value: amountUSD.toFixed(2)
            },
            note_to_payer: note || 'RuryLib - Refund for cancelled order'
        };
        
        const response = await axios.post(
            `${PAYPAL_API_URL}/v2/payments/captures/${captureId}/refund`,
            refundData,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        const refund = response.data;
        
        if (refund.status === 'COMPLETED') {
            console.log('✅ PayPal refund completed:', refund.id);
            
            return {
                success: true,
                refundId: refund.id,
                amount: parseFloat(refund.amount.value),
                currency: refund.amount.currency_code,
                status: refund.status
            };
        } else {
            console.warn('⚠️ PayPal refund pending:', refund.status);
            return {
                success: true,
                refundId: refund.id,
                amount: parseFloat(refund.amount.value),
                currency: refund.amount.currency_code,
                status: refund.status,
                message: 'Refund is being processed'
            };
        }
    } catch (error) {
        console.error('❌ Error refunding PayPal payment:', error.response?.data || error.message);
        
        // Check for specific error cases
        if (error.response?.data?.name === 'TRANSACTION_ALREADY_REFUNDED') {
            return {
                success: false,
                message: 'This transaction has already been refunded'
            };
        }
        
        throw new Error('Failed to refund PayPal payment');
    }
};

export default {
    createPayPalOrder,
    capturePayPalOrder,
    getOrderDetails,
    refundPayPalPayment,
    convertVNDtoUSD
};
