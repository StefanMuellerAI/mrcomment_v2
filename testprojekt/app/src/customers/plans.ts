export interface CustomerPlan {
  id: string;          // e.g., "free_tier", "basic_monthly", "premium_annual"
  name: string;        // e.g., "Free Tier", "Basic Monthly", "Premium Annual"
  price?: string;       // e.g., "$0/month", "$10/month", "$100/year" (display only for now)
  description?: string; // Short description of the plan
  features?: string[];  // List of features
  dailyCommentLimit: number; // New field for daily comment generation limit
  maxPostsPerCustomer: number; // New field for max posts limit
}

export const customerPlans: CustomerPlan[] = [
  {
    id: "free_tier",
    name: "Free Tier",
    price: "$0/month",
    description: "Basic access for new customers.",
    features: [
      "Limited usage of feature X",
      "Access to feature Y",
      "Community support",
      "1 comment generation per day per customer",
      "Max. 2 saved posts per customer"
    ],
    dailyCommentLimit: 1,
    maxPostsPerCustomer: 2,
  },
  {
    id: "basic_tier",
    name: "Basic Tier",
    price: "$10/month",
    description: "More features for growing needs.",
    features: [
      "Increased usage of feature X",
      "Full access to feature Y",
      "Priority community support",
      "10 comment generations per day per customer",
      "Max. 10 saved posts per customer"
    ],
    dailyCommentLimit: 10,
    maxPostsPerCustomer: 10,
  },
  {
    id: "premium_tier",
    name: "Premium Tier",
    price: "$25/month",
    description: "All features for power users.",
    features: [
      "Unlimited usage of feature X",
      "Full access to all features",
      "Dedicated email support",
      "20 comment generations per day per customer",
      "Max. 20 saved posts per customer"
    ],
    dailyCommentLimit: 20,
    maxPostsPerCustomer: 20,
  }
];

export const getPlanById = (planId: string | null | undefined): CustomerPlan | undefined => {
  if (!planId) return undefined;
  return customerPlans.find(plan => plan.id === planId);
}; 