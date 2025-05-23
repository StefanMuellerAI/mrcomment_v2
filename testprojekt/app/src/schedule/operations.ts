import { HttpError } from 'wasp/server';
import type { User, LinkedInPost, Schedule, Customer } from 'wasp/entities'; // Import necessary entities
import type { 
    SetPostSchedule,
    DeletePostSchedule,
    GetPostSchedule,
    GetScheduledPostsForCustomer,
    GetSchedulesByDateRange
} from 'wasp/server/operations'; // These types will be generated by Wasp based on main.wasp
import { prisma } from 'wasp/server'; // Import Prisma Client

// Input type for creating/updating a schedule
type SetPostScheduleInput = {
    linkedInPostId: string;
    postingDate: Date;
    reminderInMinutes?: number | null; // Allow null to explicitly remove reminder
    isReminderSent?: boolean; // Optional, defaults to false in schema or can be reset
    isPosted?: boolean;       // Optional, defaults to false in schema or can be reset
};

// Input type for deleting a schedule
type DeletePostScheduleInput = {
    linkedInPostId: string;
};

// Input type for fetching a specific schedule
type GetPostScheduleInput = {
    linkedInPostId: string;
};

// Input type for fetching posts of a customer (name will be kept for Wasp ops, but logic fetches all posts)
type GetScheduledPostsForCustomerInput = {
    customerId: string;
};

// Input type for fetching schedules in a date range
type GetSchedulesByDateRangeInput = {
    startDate: Date;
    endDate: Date;
    customerId?: string; // Optional: to filter by customer in calendar view
};

// Stub for setPostSchedule Action
export const setPostSchedule: SetPostSchedule<SetPostScheduleInput, Schedule> = async (args, context) => {
    if (!context.user) { throw new HttpError(401, 'User not authenticated'); }

    const post = await prisma.linkedInPost.findUnique({
        where: { id: args.linkedInPostId },
    });

    if (!post) { throw new HttpError(404, 'LinkedIn post not found'); }
    if (post.userId !== context.user.id) { throw new HttpError(403, 'User not authorized to schedule this post'); }

    const { linkedInPostId, postingDate, reminderInMinutes, isReminderSent, isPosted } = args;

    // Validate reminderInMinutes if provided
    if (reminderInMinutes !== undefined && reminderInMinutes !== null && ![15, 30, 60].includes(reminderInMinutes)) {
        throw new HttpError(400, 'Invalid reminder time. Allowed values are 15, 30, or 60 minutes.');
    }

    return prisma.schedule.upsert({
        where: { linkedInPostId },
        create: {
            linkedInPostId,
            postingDate,
            reminderInMinutes,
            isReminderSent: isReminderSent === undefined ? false : isReminderSent, // Default to false if not specified on create
            isPosted: isPosted === undefined ? false : isPosted,             // Default to false if not specified on create
        },
        update: {
            postingDate,
            reminderInMinutes,
            // If postingDate changes, reset reminder and posted status unless explicitly provided
            isReminderSent: args.postingDate !== undefined && isReminderSent === undefined ? false : isReminderSent,
            isPosted: args.postingDate !== undefined && isPosted === undefined ? false : isPosted,
        },
    });
};

// Stub for deletePostSchedule Action
export const deletePostSchedule: DeletePostSchedule<DeletePostScheduleInput, void> = async (args, context) => {
    if (!context.user) { throw new HttpError(401, 'User not authenticated'); }

    const schedule = await prisma.schedule.findUnique({
        where: { linkedInPostId: args.linkedInPostId },
        include: { linkedInPost: true },
    });

    if (!schedule) { return; /* Or throw HttpError(404, 'Schedule not found'); */ }
    if (schedule.linkedInPost.userId !== context.user.id) { throw new HttpError(403, 'User not authorized to delete this schedule'); }

    await prisma.schedule.delete({ where: { linkedInPostId: args.linkedInPostId } });
};

// Stub for getPostSchedule Query
export const getPostSchedule: GetPostSchedule<GetPostScheduleInput, Schedule | null> = async (args, context) => {
    if (!context.user) { throw new HttpError(401, 'User not authenticated'); }

    const schedule = await prisma.schedule.findUnique({
        where: { linkedInPostId: args.linkedInPostId },
        include: { linkedInPost: true },
    });

    if (!schedule) { return null; }
    if (schedule.linkedInPost.userId !== context.user.id) { throw new HttpError(403, 'User not authorized to view this schedule'); }

    // Return schedule without the nested post if not needed, or adjust as per frontend requirements
    const { linkedInPost, ...scheduleData } = schedule;
    return scheduleData as Schedule; 
};

// Stub for getScheduledPostsForCustomer Query
// This might return an array of LinkedInPost objects, each potentially including its Schedule
type PostWithOptionalSchedule = LinkedInPost & { schedule?: Schedule | null };
export const getScheduledPostsForCustomer: GetScheduledPostsForCustomer<GetScheduledPostsForCustomerInput, PostWithOptionalSchedule[]> = async (args, context) => {
    if (!context.user) { throw new HttpError(401, 'User not authenticated'); }

    // Verify user owns the customer
    const customer = await prisma.customer.findUnique({
        where: { id: args.customerId }
    });
    if (!customer || customer.userId !== context.user.id) {
        throw new HttpError(403, 'User not authorized to view posts for this customer');
    }

    return prisma.linkedInPost.findMany({
        where: { 
            customerId: args.customerId,
            userId: context.user.id // Ensure user owns the posts as an extra check
        },
        include: { schedule: true }, // Include schedule if it exists
        orderBy: { createdAt: 'desc' } // Optional: order by creation date
    });
};

// Stub for getSchedulesByDateRange Query
// This might return an array of Schedule objects, each including its LinkedInPost
type ScheduleWithPostAndCustomer = Schedule & { linkedInPost: LinkedInPost & { customer: Customer } };
export const getSchedulesByDateRange: GetSchedulesByDateRange<GetSchedulesByDateRangeInput, ScheduleWithPostAndCustomer[]> = async (args, context) => {
    if (!context.user) { throw new HttpError(401, 'User not authenticated'); }

    const whereClause: any = {
        postingDate: { 
            gte: args.startDate,
            lte: args.endDate 
        },
        linkedInPost: {
            userId: context.user.id,
        }
    };

    if (args.customerId) {
        whereClause.linkedInPost.customerId = args.customerId;
    }

    return prisma.schedule.findMany({
        where: whereClause,
        include: {
            linkedInPost: {
                include: { customer: true }
            }
        },
        orderBy: { postingDate: 'asc' }
    });
};

// Optional: If you uncommented the job in main.wasp, you'd need a stub for it too.
// export const sendScheduledReminders = async (args, context) => {
//   console.log('sendScheduledReminders job executed');
//   // TODO: Implement reminder logic
// }; 