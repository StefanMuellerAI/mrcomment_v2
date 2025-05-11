import { HttpError } from 'wasp/server';
import type { LinkedInPost, User, Customer } from 'wasp/entities'; // User and Customer might be needed if we include their data
import type { GetAllLinkedInPostsForUser } from 'wasp/server/operations'; // Wasp will generate this type
// No Zod schema needed for input if it takes no arguments

// Define the expected return type: an array of LinkedInPost entities,
// potentially enriched with customer name.
export type ArchivedPost = LinkedInPost & {
  customer?: Pick<Customer, 'name'>; // Include customer's name
};

// Explicitly type _args as void for no-argument queries used with useQuery(query, {})
export const getAllLinkedInPostsForUser: GetAllLinkedInPostsForUser<void, ArchivedPost[]> = async (_args: void, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User is not authenticated');
  }

  const posts = await context.entities.LinkedInPost.findMany({
    where: {
      userId: context.user.id,
    },
    include: {
      customer: { // Include the customer to get their name
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      updatedAt: 'desc', // Show most recently updated posts first
    },
  });

  return posts.map(post => ({
    ...post,
    customer: post.customer ? { name: post.customer.name } : undefined,
  }));
}; 