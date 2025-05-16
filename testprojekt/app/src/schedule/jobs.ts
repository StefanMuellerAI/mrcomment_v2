import { prisma } from 'wasp/server';
import type { User, LinkedInPost, Schedule } from 'wasp/entities';
import type { SendScheduledReminders } from 'wasp/server/jobs';
import { getPostReminderEmailContent } from './emails';
import { type EmailSender } from 'wasp/server/email';
import { publishPostToLinkedIn } from '../server/linkedinIntegration';

interface JobArgs extends Record<string, never> { }

type MarkScheduledPostsAsPostedJob = (args: JobArgs, context: { prisma: typeof prisma }) => Promise<void>;

// Die sendScheduledReminders Funktion bleibt hier unverändert...
export const sendScheduledReminders: SendScheduledReminders<JobArgs, void> = async (args, context) => {
  console.log('[Job] sendScheduledReminders started at', new Date().toISOString());
  const now = new Date();
  const dueSchedules = await prisma.schedule.findMany({
    where: {
      isReminderSent: false,
      reminderInMinutes: { not: null },
      postingDate: { gt: now },
    },
    include: {
      linkedInPost: {
        include: { user: true, customer: true },
      },
    },
  });
  console.log(`[Job] Found ${dueSchedules.length} potentially due schedules to check for reminders.`);
  let remindersSentCount = 0;
  const emailSender = (context as any).emailSender as EmailSender | undefined;
  if (!emailSender) {
    console.warn("[Job] Email sender not found in context for sendScheduledReminders. Skipping reminder sending part. Ensure emailSender is configured in main.wasp if reminders are needed.");
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

// === Beginn der markScheduledPostsAsPosted Funktion ===
export const markScheduledPostsAsPosted: MarkScheduledPostsAsPostedJob = async (args, context) => {
  console.log('!!! [Job] markScheduledPostsAsPosted FUNCTION ENTERED !!!', new Date().toISOString());

  const jobStartTime = new Date();
  console.log(`[Job] markScheduledPostsAsPosted jobStartTime: ${jobStartTime.toISOString()}`);

  const currentPrismaClient = context.prisma;

  try {
    const allPendingSchedules = await currentPrismaClient.schedule.findMany({
      where: { isPosted: false },
      include: { linkedInPost: true },
    });

    if (allPendingSchedules.length > 0) {
      console.log(`[Job] Found ${allPendingSchedules.length} total schedules with isPosted:false (pre-filter).`);
      allPendingSchedules.forEach(s => {
        console.log(`[Job] Pre-filter check: DB Post ID ${s.linkedInPostId}, PostingDate (DB): ${s.postingDate.toISOString()}, isPosted: ${s.isPosted}`);
      });
    } else {
      console.log('[Job] No schedules found with isPosted:false (pre-filter).');
    }
  } catch (dbError: any) {
    console.error('[Job] Error querying allPendingSchedules:', dbError.message, dbError.stack);
    console.log('!!! [Job] markScheduledPostsAsPosted FUNCTION FINISHING due to error in allPendingSchedules query !!!', new Date().toISOString());
    return;
  }

  const duePostsToMarkPosted = await currentPrismaClient.schedule.findMany({
    where: {
      isPosted: false,
      postingDate: { lte: jobStartTime },
    },
    include: {
      linkedInPost: true,
    }
  });

  if (duePostsToMarkPosted.length > 0) {
    console.log(`[Job] Found ${duePostsToMarkPosted.length} posts due for publishing (post-filter).`);
    let postsSuccessfullyPublishedCount = 0;

    for (const schedule of duePostsToMarkPosted) {
      if (!schedule.linkedInPost) {
        console.error(`[Job] Skipping schedule ${schedule.linkedInPostId} because linkedInPost data is missing for due post.`);
        continue;
      }
      try {
        console.log(`[Job] Attempting to publish LinkedIn post with DB ID: ${schedule.linkedInPost.id} (Scheduled for: ${schedule.postingDate.toISOString()})`);
        
        const contextForPublish = { prisma: currentPrismaClient };

        await publishPostToLinkedIn(
          { linkedInPostIdDb: schedule.linkedInPost.id },
          contextForPublish
        );

        console.log(`[Job] Successfully published post ${schedule.linkedInPost.id} to LinkedIn.`);
        await currentPrismaClient.schedule.update({
          where: { linkedInPostId: schedule.linkedInPostId },
          data: { isPosted: true },
        });
        postsSuccessfullyPublishedCount++;

      } catch (error: any) {
        console.error(`[Job] Failed to publish post ${schedule.linkedInPost.id} to LinkedIn: ${error.message}`, error.stack);
      }
    }
    console.log(`[Job] Publishing attempts finished. ${postsSuccessfullyPublishedCount} posts successfully published and marked as posted.`);
  } else {
    console.log('[Job] No posts due to be published at this time (post-filter).');
  }

  console.log('!!! [Job] markScheduledPostsAsPosted FUNCTION FINISHING (all logic re-enabled) !!!', new Date().toISOString());
};
// === Ende der markScheduledPostsAsPosted Funktion ===