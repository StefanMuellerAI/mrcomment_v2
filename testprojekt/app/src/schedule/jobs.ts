import { prisma } from 'wasp/server';
import type { User, LinkedInPost, Schedule } from 'wasp/entities';
import type { SendScheduledReminders } from 'wasp/server/jobs'; // Wasp type for the job
import { getPostReminderEmailContent } from './emails'; // Email content function
import { type EmailSender } from 'wasp/server/email'; // Wasp < 1.0 often exposes emailSender via this type

// Define JobArgs as an empty object type that satisfies JSONObject for Wasp
// If the job truly takes no args, Record<string, never> is a good fit.
// Or, ensure it aligns with how Wasp expects cron job args (often implicitly an empty object).
interface JobArgs extends Record<string, never> { 
  // No specific arguments for this cron job
}

// Type for the new job that will mark posts as posted
// It doesn't take specific arguments from the cron definition and returns void
type MarkScheduledPostsAsPostedJob = (args: JobArgs, context: { prisma: typeof prisma }) => Promise<void>;

export const sendScheduledReminders: SendScheduledReminders<JobArgs, void> = async (args, context) => {
  console.log('[Job] sendScheduledReminders started at', new Date().toISOString());

  const now = new Date();

  // Find schedules where reminder time has passed but post time hasn't, and reminder not sent
  const dueSchedules = await prisma.schedule.findMany({
    where: {
      isReminderSent: false,
      reminderInMinutes: { not: null }, // Reminder must be set
      postingDate: { gt: now },        // Post must be in the future
      // Reminder time check is done in the loop below
    },
    include: {
      linkedInPost: {
        include: {
          user: true, 
          customer: true 
        },
      },
    },
  });

  console.log(`[Job] Found ${dueSchedules.length} potentially due schedules to check for reminders.`);
  let remindersSentCount = 0;

  const emailSender = (context as any).emailSender as EmailSender | undefined;
  
  if (!emailSender) {
    // Log a warning instead of an error, as the job might run in an environment
    // where email sending is not configured, but other functionalities (if any added later)
    // of this job or other jobs should not be blocked.
    console.warn("[Job] Email sender not found in context for sendScheduledReminders. Skipping reminder sending part. Ensure emailSender is configured in main.wasp if reminders are needed.");
    // If there were other tasks for this job besides sending emails, they could continue here.
    // For now, if no emailSender, this job effectively does nothing more.
  } else {
    for (const schedule of dueSchedules) {
      if (!schedule.reminderInMinutes || !schedule.linkedInPost?.user?.email) {
        console.warn(`[Job] Skipping reminder for schedule ${schedule.linkedInPostId} due to missing reminder minutes, user, or email.`);
        continue;
      }

      const reminderTime = new Date(schedule.postingDate.getTime() - schedule.reminderInMinutes * 60000);

      if (reminderTime <= now) {
        console.log(`[Job] Processing reminder for post ${schedule.linkedInPost.id} for user ${schedule.linkedInPost.user.email}`);
        
        const emailContent = getPostReminderEmailContent({
          user: schedule.linkedInPost.user,
          post: schedule.linkedInPost,
          schedule: schedule,
        });

        try {
          await emailSender.send({
            to: schedule.linkedInPost.user.email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
          });

          await prisma.schedule.update({
            where: { linkedInPostId: schedule.linkedInPostId },
            data: { isReminderSent: true },
          });
          remindersSentCount++;
          console.log(`[Job] Reminder sent for post ${schedule.linkedInPost.id} and marked as sent.`);
        } catch (error: any) {
          console.error(`[Job] Failed to send reminder for post ${schedule.linkedInPost.id}:`, error.message);
        }
      }
    }
  }
  console.log(`[Job] sendScheduledReminders finished at ${new Date().toISOString()}. ${remindersSentCount} reminders sent.`);
};

// New Job: Mark Scheduled Posts as Posted
export const markScheduledPostsAsPosted: MarkScheduledPostsAsPostedJob = async (args, context) => {
  console.log('[Job] markScheduledPostsAsPosted started at', new Date().toISOString());
  const now = new Date();

  const duePostsToMarkPosted = await context.prisma.schedule.findMany({
    where: {
      isPosted: false,
      postingDate: { lte: now }, // Posting date is now or in the past
    },
  });

  if (duePostsToMarkPosted.length > 0) {
    console.log(`[Job] Found ${duePostsToMarkPosted.length} posts to mark as posted.`);
    let postsMarkedAsPostedCount = 0;

    for (const schedule of duePostsToMarkPosted) {
      try {
        await context.prisma.schedule.update({
          where: { linkedInPostId: schedule.linkedInPostId },
          data: { isPosted: true },
        });
        postsMarkedAsPostedCount++;
        console.log(`[Job] Marked post ${schedule.linkedInPostId} as posted.`);
      } catch (error: any) {
        console.error(`[Job] Failed to mark post ${schedule.linkedInPostId} as posted:`, error.message);
      }
    }
    console.log(`[Job] Marking posts as posted finished. ${postsMarkedAsPostedCount} posts marked.`);
  } else {
    console.log('[Job] No posts due to be marked as posted at this time.');
  }
  console.log(`[Job] markScheduledPostsAsPosted finished at ${new Date().toISOString()}.`);
}; 