import { HttpError } from 'wasp/server';
import { prisma } from 'wasp/server'; // Import prisma
import type { LinkedInPost, User, Customer, Schedule } from 'wasp/entities'; // User and Customer might be needed if we include their data
import type { GetAllLinkedInPostsForUser } from 'wasp/server/operations'; // Wasp will generate this type
// No Zod schema needed for input if it takes no arguments

// Define the expected return type: an array of LinkedInPost entities,
// potentially enriched with customer name.
export type PostWithCustomerAndSchedule = LinkedInPost & {
  customer: Customer;
  schedule: Schedule | null;
};

// Explicitly type _args as void for no-argument queries used with useQuery(query, {})
export const getAllLinkedInPostsForUser: GetAllLinkedInPostsForUser<void, PostWithCustomerAndSchedule[]> = async (_args: void, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  return prisma.linkedInPost.findMany({
    where: {
      userId: context.user.id,
    },
    include: {
      customer: true, // Include customer data
      schedule: true, // Include schedule data
    },
    orderBy: {
      createdAt: 'desc', // Order by creation date, newest first
    },
  });
}; 