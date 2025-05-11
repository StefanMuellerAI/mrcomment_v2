import { HttpError } from 'wasp/server';
import { type User, type Customer } from 'wasp/entities';
import type { GetUsersForAdminDashboard, GetGlobalUsageStats } from 'wasp/server/operations';
import { type Prisma } from '@prisma/client';

// Define the structure of the user data we want to return
type AdminUserData = Pick<
    User, 
    'id' | 'email' | 'username' | 'isAdmin' | 'subscriptionStatus' | 'commentRequestCount'
> & {
    _count: { customers: number };
};

// Output type for the new query
type GlobalUsageStats = {
    totalCustomers: number;
    totalCommentRequests: number;
};

export const getUsersForAdminDashboard: GetUsersForAdminDashboard<void, AdminUserData[]> = async (_args, context) => {
    if (!context.user?.isAdmin) {
        throw new HttpError(403, 'Administrative privileges required.');
    }

    const users = await context.entities.User.findMany({
        select: {
            id: true,
            email: true,
            username: true,
            isAdmin: true,
            subscriptionStatus: true,
            commentRequestCount: true,
            _count: { // Include the count of related customers
                select: { customers: true }
            }
        },
        orderBy: {
            createdAt: 'desc' // Or order by email/username
        }
    });

    // Ensure the return type matches AdminUserData[]
    return users.map(user => ({
        ...user,
        // Prisma returns _count as potentially null if no relations exist, ensure it's a number
        _count: {
             customers: user._count?.customers ?? 0
        }
    }));
};

// Implementation for the new query
export const getGlobalUsageStats: GetGlobalUsageStats<void, GlobalUsageStats> = async (_args, context) => {
    if (!context.user?.isAdmin) {
        throw new HttpError(403, 'Administrative privileges required.');
    }

    // Count total customers
    const totalCustomers = await context.entities.Customer.count();

    // Sum up comment requests
    const commentSumResult = await context.entities.User.aggregate({
        _sum: {
            commentRequestCount: true,
        },
    });

    const totalCommentRequests = commentSumResult._sum.commentRequestCount ?? 0;

    return {
        totalCustomers,
        totalCommentRequests,
    };
}; 