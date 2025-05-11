import * as z from 'zod';
import { 
    type UpdateIsUserAdminById, 
    type GetPaginatedUsers,
    type UpdateEmail,
    type UpdateUsername,
    type UpdatePassword 
} from 'wasp/server/operations';
import { type User } from 'wasp/entities';
import { HttpError, prisma } from 'wasp/server';
import { SubscriptionStatus } from '../payment/plans';
import { type Prisma } from '@prisma/client';
import { ensureArgsSchemaOrThrowHttpError } from '../server/validation';

const updateUserAdminByIdInputSchema = z.object({
  id: z.string().nonempty(),
  isAdmin: z.boolean(),
});

type UpdateUserAdminByIdInput = z.infer<typeof updateUserAdminByIdInputSchema>;

export const updateIsUserAdminById: UpdateIsUserAdminById<UpdateUserAdminByIdInput, User> = async (
  rawArgs,
  context
) => {
  const { id, isAdmin } = ensureArgsSchemaOrThrowHttpError(updateUserAdminByIdInputSchema, rawArgs);

  if (!context.user) {
    throw new HttpError(401, 'Only authenticated users are allowed to perform this operation');
  }

  if (!context.user.isAdmin) {
    throw new HttpError(403, 'Only admins are allowed to perform this operation');
  }

  return context.entities.User.update({
    where: { id },
    data: { isAdmin },
  });
};

type GetPaginatedUsersOutput = {
  users: Pick<
    User,
    'id' | 'email' | 'username' | 'subscriptionStatus' | 'paymentProcessorUserId' | 'isAdmin'
  >[];
  totalPages: number;
};

const getPaginatorArgsSchema = z.object({
  skipPages: z.number(),
  filter: z.object({
    emailContains: z.string().nonempty().optional(),
    isAdmin: z.boolean().optional(),
    subscriptionStatusIn: z.array(z.nativeEnum(SubscriptionStatus).nullable()).optional(),
  }),
});

type GetPaginatedUsersInput = z.infer<typeof getPaginatorArgsSchema>;

export const getPaginatedUsers: GetPaginatedUsers<GetPaginatedUsersInput, GetPaginatedUsersOutput> = async (
  rawArgs,
  context
) => {
  if (!context.user) {
    throw new HttpError(401, 'Only authenticated users are allowed to perform this operation');
  }

  if (!context.user.isAdmin) {
    throw new HttpError(403, 'Only admins are allowed to perform this operation');
  }

  const {
    skipPages,
    filter: { subscriptionStatusIn: subscriptionStatus, emailContains, isAdmin },
  } = ensureArgsSchemaOrThrowHttpError(getPaginatorArgsSchema, rawArgs);

  const includeUnsubscribedUsers = !!subscriptionStatus?.some((status) => status === null);
  const desiredSubscriptionStatuses = subscriptionStatus?.filter((status) => status !== null);

  const pageSize = 10;

  const userPageQuery: Prisma.UserFindManyArgs = {
    skip: skipPages * pageSize,
    take: pageSize,
    where: {
      AND: [
        {
          email: {
            contains: emailContains,
            mode: 'insensitive',
          },
          isAdmin,
        },
        {
          OR: [
            {
              subscriptionStatus: {
                in: desiredSubscriptionStatuses,
              },
            },
            {
              subscriptionStatus: includeUnsubscribedUsers ? null : undefined,
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      email: true,
      username: true,
      isAdmin: true,
      subscriptionStatus: true,
      paymentProcessorUserId: true,
    },
    orderBy: {
      username: 'asc',
    },
  };

  const [pageOfUsers, totalUsers] = await prisma.$transaction([
    context.entities.User.findMany(userPageQuery),
    context.entities.User.count({ where: userPageQuery.where }),
  ]);
  const totalPages = Math.ceil(totalUsers / pageSize);

  return {
    users: pageOfUsers,
    totalPages,
  };
};

const updateEmailInputSchema = z.object({
    newEmail: z.string().email("Invalid email format"),
});
type UpdateEmailInput = z.infer<typeof updateEmailInputSchema>;

export const updateEmail: UpdateEmail<UpdateEmailInput, User> = async (rawArgs, context) => {
    if (!context.user) {
        throw new HttpError(401);
    }
    const { newEmail } = ensureArgsSchemaOrThrowHttpError(updateEmailInputSchema, rawArgs);

    const existingUser = await context.entities.User.findUnique({ where: { email: newEmail } });
    if (existingUser && existingUser.id !== context.user.id) {
        throw new HttpError(400, "Email address is already in use.");
    }

    return context.entities.User.update({
        where: { id: context.user.id },
        data: { email: newEmail },
    });
};

const updateUsernameInputSchema = z.object({
    newUsername: z.string().min(3, "Username must be at least 3 characters long"),
});
type UpdateUsernameInput = z.infer<typeof updateUsernameInputSchema>;

export const updateUsername: UpdateUsername<UpdateUsernameInput, User> = async (rawArgs, context) => {
    if (!context.user) {
        throw new HttpError(401);
    }
    const { newUsername } = ensureArgsSchemaOrThrowHttpError(updateUsernameInputSchema, rawArgs);

    const existingUser = await context.entities.User.findUnique({ where: { username: newUsername } });
    if (existingUser && existingUser.id !== context.user.id) {
        throw new HttpError(400, "Username is already taken.");
    }

    return context.entities.User.update({
        where: { id: context.user.id },
        data: { username: newUsername },
    });
};

const updatePasswordInputSchema = z.object({
    currentPassword: z.string(),
    newPassword: z.string().min(8, "Password must be at least 8 characters long"),
});
type UpdatePasswordInput = z.infer<typeof updatePasswordInputSchema>;

export const updatePassword: UpdatePassword<UpdatePasswordInput, User> = async (rawArgs, context) => {
    if (!context.user) {
        throw new HttpError(401);
    }
    const { currentPassword, newPassword } = ensureArgsSchemaOrThrowHttpError(updatePasswordInputSchema, rawArgs);

    throw new HttpError(501, "Secure password update not implemented. See TODO in operations.ts");
};
