import React from 'react';
import { Link } from 'wasp/client/router';
import { useQuery, getAllCustomers, deleteCustomer } from 'wasp/client/operations';
import type { Customer } from 'wasp/entities';
import { CgSpinner } from 'react-icons/cg';
import { TiDelete } from 'react-icons/ti';
import { IoPencilOutline, IoAddCircleOutline } from 'react-icons/io5';
import { routes } from 'wasp/client/router';

const CustomersPage: React.FC = () => {
  const { data: customers, isLoading, error, refetch } = useQuery(getAllCustomers) as {
    data: Customer[] | undefined;
    isLoading: boolean;
    error: any;
    refetch: () => void;
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (window.confirm('Are you sure you want to delete this customer and all their associated data (styles, personas, posts, etc.)?')) {
      try {
        await deleteCustomer({ customerId });
        refetch();
      } catch (err: any) {
        window.alert('Error deleting customer: ' + (err.message || 'Something went wrong.'));
      }
    }
  };

  if (isLoading) return (
    <div className='flex justify-center items-center h-screen'>
      <CgSpinner className='animate-spin text-4xl text-yellow-500' />
    </div>
  );
  if (error) return <div className='p-4 text-red-500'>Error loading customers: {error.message}</div>;

  return (
    <div className='py-4 md:py-8 px-0 md:px-0'>
      <div className='flex justify-between items-center mb-8 px-4 md:px-8'>
        <h1 className='text-3xl font-bold text-gray-800 dark:text-white'>My Customers</h1>
        <Link
          to={routes.NewCustomerRoute.to}
          className='flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 shadow-md transition-colors duration-200 text-sm font-medium'
        >
          <IoAddCircleOutline className="mr-2 h-5 w-5" /> Add New Customer
        </Link>
      </div>

      {customers && customers.length > 0 ? (
        <div className="overflow-x-auto bg-white dark:bg-gray-800 shadow-md rounded-lg mx-4 md:mx-8">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Created At</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Subscription Plan</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {customer.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {new Date(customer.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {customer.subscriptionPlan || 'N/A'} 
                    {customer.subscriptionStatus && customer.subscriptionPlan ? ` (${customer.subscriptionStatus})` : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex items-center space-x-3">
                    <Link 
                      to={routes.CustomerDetailsRoute.to} 
                      params={{ customerId: customer.id }}
                      className='text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300'
                      title="Edit Customer"
                    >
                      <IoPencilOutline size={20}/>
                    </Link>
                    <button 
                      onClick={() => handleDeleteCustomer(customer.id)}
                      title='Delete Customer'
                      className='p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300'
                    >
                      <TiDelete size='22' />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className='text-center py-10 px-6 bg-white dark:bg-gray-800 rounded-lg shadow-md mx-4 md:mx-8'>
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2zm3-6h.01M17 10h.01" />
          </svg>
          <h3 className='mt-2 text-sm font-semibold text-gray-900 dark:text-white'>No customers yet</h3>
          <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>Get started by creating a new customer.</p>
          <div className='mt-6'>
            <Link
              to={routes.NewCustomerRoute.to}
              className='inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
            >
              <IoAddCircleOutline className="mr-2 h-5 w-5" /> Create Customer
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomersPage; 