import type { User, LinkedInPost, Schedule } from 'wasp/entities';

interface EmailContentArgs {
  user: User;
  post: LinkedInPost;
  schedule: Schedule;
}

export function getPostReminderEmailContent({ user, post, schedule }: EmailContentArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const postTime = new Date(schedule.postingDate).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false, // Use 24-hour format or adjust as needed
  });
  const postDate = new Date(schedule.postingDate).toLocaleDateString([], {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const subject = `Reminder: Your LinkedIn Post is scheduled for ${postTime} today!`;

  const html = `
    <p>Hi ${user.username || user.email || 'User'},</p>
    <p>This is a friendly reminder that your LinkedIn post is scheduled for today, <strong>${postDate}</strong> at <strong>${postTime}</strong>.</p>
    <p><strong>Post Hook:</strong> ${post.hook}</p>
    ${post.content ? `<p><strong>Content Preview:</strong> ${post.content.substring(0, 150)}...</p>` : ''}
    <p>Make sure you're ready to publish it!</p>
    <p>Best regards,<br>Mr.Comment Team</p>
  `;

  const text = `
    Hi ${user.username || user.email || 'User'},
    This is a friendly reminder that your LinkedIn post is scheduled for today, ${postDate} at ${postTime}.
    Post Hook: ${post.hook}
    ${post.content ? `Content Preview: ${post.content.substring(0, 150)}...` : ''}
    Make sure you're ready to publish it!
    Best regards,
    Mr.Comment Team
  `;

  return { subject, html, text };
} 