
import User from "../models/user.js";
import Bill from "../models/bills.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { validationResult } from "express-validator";
import nodemailer from "nodemailer";
import schedule from "node-schedule";

// Email configuration
const createEmailTransporter = () => {
    return nodemailer.createTransporter({
        service: 'gmail', // or your preferred email service
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

// Send email function
export const sendEmail = async (emailData) => {
    try {
        const transporter = createEmailTransporter();
        
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: emailData.to,
            subject: emailData.subject || 'Bill Reminder',
            html: emailData.html || `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Bill Reminder</h2>
                    <p>Dear ${emailData.userName || 'User'},</p>
                    <p>This is a friendly reminder about your upcoming bill:</p>
                    
                    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="color: #555; margin-top: 0;">${emailData.billTitle}</h3>
                        <p><strong>Amount:</strong> ${emailData.formattedAmount}</p>
                        <p><strong>Due Date:</strong> ${emailData.dueDate}</p>
                        <p><strong>To:</strong> ${emailData.toWhom}</p>
                        ${emailData.notes ? `<p><strong>Notes:</strong> ${emailData.notes}</p>` : ''}
                    </div>
                    
                    <p>Please make sure to pay this bill on time to avoid any late fees.</p>
                    <p>Best regards,<br>Your Finance Tracker</p>
                </div>
            `
        };

        const result = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', result.messageId);
        return result;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

// Schedule recurring bill email reminders
export const recurringBillEmail = async (req, res) => {
    try {
        const { billId, userEmail, recurring, dueDate } = req.body;

        // Validate required fields
        if (!billId || !userEmail || !recurring || !dueDate) {
            return res.status(400).json({
                success: false,
                message: 'Bill ID, user email, recurring type, and due date are required'
            });
        }

        // Get bill details
        const bill = await Bill.findById(billId);
        if (!bill) {
            return res.status(404).json({
                success: false,
                message: 'Bill not found'
            });
        }

        // Get user details
        const user = await User.findById(bill.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const billDueDate = new Date(dueDate);
        const currentDate = new Date();

        // Prepare email data
        const emailData = {
            to: userEmail,
            subject: `Reminder: ${bill.title} - Bill Due Soon`,
            userName: user.username,
            billTitle: bill.title,
            formattedAmount: bill.formattedAmount,
            dueDate: billDueDate.toLocaleDateString(),
            toWhom: bill.toWhom,
            notes: bill.notes
        };

        let jobName = `bill-reminder-${billId}-${Date.now()}`;

        // Schedule based on recurring type
        switch (recurring.toLowerCase()) {
            case 'daily':
                schedule.scheduleJob(jobName, { hour: 9, minute: 0 }, () => {
                    sendEmail(emailData).catch(err => 
                        console.error('Failed to send daily reminder:', err)
                    );
                });
                break;

            case 'weekly':
                const dayOfWeek = billDueDate.getDay();
                schedule.scheduleJob(jobName, { 
                    hour: 9, 
                    minute: 0, 
                    dayOfWeek: dayOfWeek 
                }, () => {
                    sendEmail(emailData).catch(err => 
                        console.error('Failed to send weekly reminder:', err)
                    );
                });
                break;

            case 'monthly':
                const dayOfMonth = billDueDate.getDate();
                if (dayOfMonth >= 1 && dayOfMonth <= 31) {
                    schedule.scheduleJob(jobName, { 
                        hour: 9, 
                        minute: 0, 
                        date: dayOfMonth 
                    }, () => {
                        sendEmail(emailData).catch(err => 
                            console.error('Failed to send monthly reminder:', err)
                        );
                    });
                }
                break;

            case 'yearly':
                schedule.scheduleJob(jobName, { 
                    hour: 9, 
                    minute: 0, 
                    month: billDueDate.getMonth(), 
                    date: billDueDate.getDate() 
                }, () => {
                    sendEmail(emailData).catch(err => 
                        console.error('Failed to send yearly reminder:', err)
                    );
                });
                break;

            case 'once':
            case 'none':
            default:
                // Send immediate reminder
                await sendEmail(emailData);
                break;
        }

        res.status(200).json({
            success: true,
            message: `Recurring email reminder set up for ${recurring} frequency`,
            jobName: jobName,
            nextRun: recurring !== 'once' && recurring !== 'none' ? 
                'Scheduled according to recurring pattern' : 'Sent immediately'
        });

    } catch (err) {
        console.error('Error setting up recurring bill email:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to set up recurring email reminder',
            error: err.message
        });
    }
};

// Send bill reminder emails based on reminder days
export const sendBillReminders = async (req, res) => {
    try {
        const { userId } = req.params;

        // Get user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get all active bills for the user
        const bills = await Bill.find({
            userId: userId,
            status: { $in: ['pending'] },
            isPaid: false
        });

        let remindersSent = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const bill of bills) {
            const dueDate = new Date(bill.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            
            const daysDifference = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

            // Check if today matches any reminder day
            if (bill.reminders.includes(daysDifference)) {
                const emailData = {
                    to: user.email,
                    subject: `Reminder: ${bill.title} - Due in ${daysDifference} day(s)`,
                    userName: user.username,
                    billTitle: bill.title,
                    formattedAmount: bill.formattedAmount,
                    dueDate: dueDate.toLocaleDateString(),
                    toWhom: bill.toWhom,
                    notes: bill.notes
                };

                try {
                    await sendEmail(emailData);
                    remindersSent++;
                } catch (emailError) {
                    console.error(`Failed to send reminder for bill ${bill._id}:`, emailError);
                }
            }
        }

        res.status(200).json({
            success: true,
            message: `Sent ${remindersSent} bill reminder(s)`,
            remindersSent
        });

    } catch (err) {
        console.error('Error sending bill reminders:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to send bill reminders',
            error: err.message
        });
    }
};

// Cancel scheduled job
export const cancelRecurringReminder = async (req, res) => {
    try {
        const { jobName } = req.body;

        if (!jobName) {
            return res.status(400).json({
                success: false,
                message: 'Job name is required'
            });
        }

        const job = schedule.scheduledJobs[jobName];
        if (job) {
            job.cancel();
            res.status(200).json({
                success: true,
                message: 'Recurring reminder cancelled successfully'
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Scheduled job not found'
            });
        }

    } catch (err) {
        console.error('Error cancelling recurring reminder:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel recurring reminder',
            error: err.message
        });
    }
};

// Get all scheduled jobs
export const getScheduledJobs = async (req, res) => {
    try {
        const jobs = Object.keys(schedule.scheduledJobs).map(jobName => ({
            name: jobName,
            nextInvocation: schedule.scheduledJobs[jobName].nextInvocation()
        }));

        res.status(200).json({
            success: true,
            jobs: jobs,
            totalJobs: jobs.length
        });

    } catch (err) {
        console.error('Error getting scheduled jobs:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to get scheduled jobs',
            error: err.message
        });
    }
};

// Send immediate bill reminder
export const sendImmediateReminder = async (req, res) => {
    try {
        const { billId, userEmail, customMessage } = req.body;

        if (!billId || !userEmail) {
            return res.status(400).json({
                success: false,
                message: 'Bill ID and user email are required'
            });
        }

        // Get bill details
        const bill = await Bill.findById(billId);
        if (!bill) {
            return res.status(404).json({
                success: false,
                message: 'Bill not found'
            });
        }

        // Get user details
        const user = await User.findById(bill.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const emailData = {
            to: userEmail,
            subject: `Urgent: ${bill.title} - Bill Reminder`,
            userName: user.username,
            billTitle: bill.title,
            formattedAmount: bill.formattedAmount,
            dueDate: new Date(bill.dueDate).toLocaleDateString(),
            toWhom: bill.toWhom,
            notes: customMessage || bill.notes
        };

        await sendEmail(emailData);

        res.status(200).json({
            success: true,
            message: 'Immediate reminder sent successfully'
        });

    } catch (err) {
        console.error('Error sending immediate reminder:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to send immediate reminder',
            error: err.message
        });
    }
};

// Setup automatic daily reminder check (to be called by cron job or scheduler)
export const setupDailyReminderCheck = () => {
    // Schedule daily check at 9 AM
    schedule.scheduleJob('daily-reminder-check', { hour: 9, minute: 0 }, async () => {
        try {
            console.log('Running daily reminder check...');
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Get all bills that need reminders today
            const bills = await Bill.aggregate([
                {
                    $match: {
                        status: 'pending',
                        isPaid: false,
                        dueDate: { $gte: today }
                    }
                },
                {
                    $addFields: {
                        daysUntilDue: {
                            $divide: [
                                { $subtract: ['$dueDate', today] },
                                1000 * 60 * 60 * 24
                            ]
                        }
                    }
                },
                {
                    $match: {
                        $expr: {
                            $in: [
                                { $ceil: '$daysUntilDue' },
                                '$reminders'
                            ]
                        }
                    }
                }
            ]);

            let totalSent = 0;

            for (const bill of bills) {
                try {
                    const user = await User.findById(bill.userId);
                    if (user && user.email) {
                        const daysDifference = Math.ceil((bill.dueDate - today) / (1000 * 60 * 60 * 24));
                        
                        const emailData = {
                            to: user.email,
                            subject: `Reminder: ${bill.title} - Due in ${daysDifference} day(s)`,
                            userName: user.username,
                            billTitle: bill.title,
                            formattedAmount: bill.formattedAmount,
                            dueDate: new Date(bill.dueDate).toLocaleDateString(),
                            toWhom: bill.toWhom,
                            notes: bill.notes
                        };

                        await sendEmail(emailData);
                        totalSent++;
                    }
                } catch (emailError) {
                    console.error(`Failed to send reminder for bill ${bill._id}:`, emailError);
                }
            }

            console.log(`Daily reminder check completed. Sent ${totalSent} reminders.`);
        } catch (error) {
            console.error('Error in daily reminder check:', error);
        }
    });

    console.log('Daily reminder check scheduled for 9:00 AM every day');
};

// Initialize the daily reminder system
export const initializeReminderSystem = () => {
    setupDailyReminderCheck();
    console.log('Bill reminder system initialized');
};

// Test email function
export const testEmail = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email address is required'
            });
        }

        const testEmailData = {
            to: email,
            subject: 'Test Email - Finance Tracker',
            userName: 'Test User',
            billTitle: 'Test Bill',
            formattedAmount: 'Rp 100,000',
            dueDate: new Date().toLocaleDateString(),
            toWhom: 'Test Company',
            notes: 'This is a test email to verify the email configuration.'
        };

        await sendEmail(testEmailData);

        res.status(200).json({
            success: true,
            message: 'Test email sent successfully'
        });

    } catch (err) {
        console.error('Error sending test email:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to send test email',
            error: err.message
        });
    }
};