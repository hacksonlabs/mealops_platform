import { supabase } from '../lib/supabase';

export const emailService = {
  async sendWelcomeEmail(userEmail, userName) {
    try {
      const { data, error } = await supabase?.functions?.invoke('send-email', {
        body: {
          to: userEmail,
          subject: 'Welcome to MealOps!',
          html: `
            <h1>Welcome ${userName}!</h1>
            <p>Thank you for joining MealOps. We're excited to help you manage your team meals.</p>
            <p>Get started by setting up your team and scheduling your first meal order.</p>
          `,
          text: `Welcome ${userName}! Thank you for joining MealOps.`
        }
      });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Welcome email error:', error);
      return { success: false, error: error?.message };
    }
  },

  async sendOrderConfirmation(userEmail, orderDetails) {
    try {
      const { data, error } = await supabase?.functions?.invoke('send-email', {
        body: {
          to: userEmail,
          subject: `Order Confirmation - ${orderDetails?.restaurantName}`,
          html: `
            <h1>Order Confirmed</h1>
            <p><strong>Restaurant:</strong> ${orderDetails?.restaurantName}</p>
            <p><strong>Date:</strong> ${new Date(orderDetails.scheduledDate)?.toLocaleDateString()}</p>
            <p><strong>Total:</strong> $${orderDetails?.total}</p>
            <p><strong>Order ID:</strong> ${orderDetails?.id}</p>
            <hr>
            <p>Your team meal order has been confirmed. We'll send updates as your order is processed.</p>
          `,
          text: `Order confirmed for ${orderDetails?.restaurantName} on ${new Date(orderDetails.scheduledDate)?.toLocaleDateString()}`
        }
      });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Order confirmation email error:', error);
      return { success: false, error: error?.message };
    }
  },

  async sendPollNotification(userEmail, pollDetails) {
    try {
      const { data, error } = await supabase?.functions?.invoke('send-email', {
        body: {
          to: userEmail,
          subject: `New Meal Poll: ${pollDetails?.title}`,
          html: `
            <h1>New Meal Poll Available</h1>
            <p><strong>Poll:</strong> ${pollDetails?.title}</p>
            <p><strong>Description:</strong> ${pollDetails?.description}</p>
            <p><strong>Expires:</strong> ${new Date(pollDetails.expiresAt)?.toLocaleDateString()}</p>
            <p>Click the link to cast your vote and help decide on the next team meal!</p>
          `,
          text: `New meal poll: ${pollDetails?.title}. Expires ${new Date(pollDetails.expiresAt)?.toLocaleDateString()}`
        }
      });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Poll notification email error:', error);
      return { success: false, error: error?.message };
    }
  }
};