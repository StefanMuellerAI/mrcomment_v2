import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, getCustomerDetails, updateCustomer, updateCustomerSubscription } from 'wasp/client/operations';
import type { Customer, Style, Persona } from 'wasp/entities';
import { CgSpinner } from 'react-icons/cg';
import { TiDelete } from 'react-icons/ti';
import { customerPlans, getPlanById, CustomerPlan } from './plans';

// Helper to format date for input type='date'
const formatDateForInput = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  try {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    return ''; // Return empty string if date is invalid
  }
};

type CustomerWithRelations = Customer & { 
  style?: Style | null;
  persona?: Persona | null;
};

const CustomerDetailsPage: React.FC = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { data: customer, isLoading, error: queryError, refetch } = useQuery(
    getCustomerDetails,
    { customerId }, 
    { enabled: !!customerId }
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state, initialized when customer data loads
  const [name, setName] = useState('');
  const [linkedinExampleInputs, setLinkedinExampleInputs] = useState<string[]>(['', '', '']);
  const [styleAnalysis, setStyleAnalysis] = useState('');
  const [birthday, setBirthday] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [fieldOfWork, setFieldOfWork] = useState('');
  const [customerProfile, setCustomerProfile] = useState('');

  // State for subscription plan selection
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);

  // Effect to populate form when customer data is loaded
  useEffect(() => {
    if (customer) {
      setName(customer.name || '');
      const loadedExamples = customer.style?.linkedinExamples || [];
      const initialInputs = [...loadedExamples];
      while (initialInputs.length < 3) {
          initialInputs.push('');
      }
      setLinkedinExampleInputs(initialInputs);
      
      setStyleAnalysis(customer.style?.styleAnalysis || '');
      setBirthday(formatDateForInput(customer.persona?.birthday));
      setJobDescription(customer.persona?.jobDescription || '');
      setFieldOfWork(customer.persona?.fieldOfWork || '');
      setCustomerProfile(customer.persona?.customerProfile || '');
      setSelectedPlanId(customer.subscriptionPlan || 'free_tier');
    }
  }, [customer]);

  // Handlers for dynamic LinkedIn examples
  const handleExampleInputChange = (index: number, value: string) => {
    const updatedInputs = [...linkedinExampleInputs];
    updatedInputs[index] = value;
    setLinkedinExampleInputs(updatedInputs);
  };

  const handleAddExampleInput = () => {
    setLinkedinExampleInputs([...linkedinExampleInputs, '']);
  };

  const handleRemoveExampleInput = (index: number) => {
    if (linkedinExampleInputs.length > 3) {
      const updatedInputs = linkedinExampleInputs.filter((_, i) => i !== index);
      setLinkedinExampleInputs(updatedInputs);
    }
  };

  const handleSubmitCustomerDetails = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customerId) return;
    setIsSubmitting(true);
    setFormError(null);
    setSuccessMessage(null);

    try {
      const styleData = {
        linkedinExamples: linkedinExampleInputs.map(s => s.trim()).filter(s => s),
        styleAnalysis,
      };
      const personaData = {
        birthday: birthday ? new Date(birthday) : undefined,
        jobDescription,
        fieldOfWork,
        customerProfile,
      };

      // Determine if examples actually changed compared to the loaded customer data
      const originalExamples = customer?.style?.linkedinExamples || [];
      const examplesChanged = originalExamples.length !== styleData.linkedinExamples.length || 
                              originalExamples.some((val, idx) => val !== styleData.linkedinExamples[idx]);

      await updateCustomer({
        customerId,
        name,
        styleData: (styleData.linkedinExamples.length > 0 || styleData.styleAnalysis.trim()) ? styleData : undefined,
        personaData: Object.values(personaData).some(v => v) ? personaData : undefined,
      });
      setSuccessMessage('Customer details updated successfully!');
      if (examplesChanged && styleData.linkedinExamples.length > 0) {
          setSuccessMessage('LinkedIn examples changed, style analysis is being regenerated in the background. Refresh the page in a moment to see the update.');
      }
      refetch();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update customer details. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePlanChange = async () => {
    if (!customerId || !selectedPlanId) {
      setFormError("Please select a plan.");
      return;
    }
    setIsUpdatingPlan(true);
    setFormError(null);
    setSuccessMessage(null);
    try {
      await updateCustomerSubscription({ customerId, planId: selectedPlanId });
      setSuccessMessage(`Customer plan updated to ${getPlanById(selectedPlanId)?.name || selectedPlanId}!`);
      refetch();
    } catch (err: any) {
      setFormError(err.message || "Failed to update customer's plan.");
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  if (isLoading) return (
    <div className='flex justify-center items-center h-screen'>
      <CgSpinner className='animate-spin text-4xl text-yellow-500' />
    </div>
  );
  if (queryError) return <div className='p-4 text-red-500'>Error loading customer details: {queryError.message}</div>;
  if (!customer) return (
    <div className='p-4 text-center text-gray-600 dark:text-gray-400'>
      Customer not found or access denied. <Link to='/customers' className='text-blue-600 hover:underline dark:text-blue-400'>Back to list</Link>
    </div>
  );

  const currentPlanDetails = getPlanById(customer.subscriptionPlan);

  // Now we are sure customer exists and is loaded
  return (
    <div className='p-4 md:p-8 max-w-full mx-auto'>
      <div className='flex justify-between items-center mb-8'>
        <h1 className='text-3xl font-bold text-gray-800 dark:text-white'>Edit Customer: {customer.name}</h1>
        <Link to='/customers' className='text-blue-600 hover:underline dark:text-blue-400'>
          Back to Customers
        </Link>
      </div>

      {formError && (
        <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6' role='alert'>
          <strong className='font-bold'>Error: </strong>
          <span className='block sm:inline'>{formError}</span>
        </div>
      )}
      {successMessage && (
        <div className='bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-6' role='alert'>
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Customer Details Form (Name, Style, Persona) */}
        <form onSubmit={handleSubmitCustomerDetails} className="md:col-span-2 space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <fieldset className="space-y-4">
            <legend className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Customer Information</legend>
            <div>
              <label htmlFor='name' className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>Name <span className='text-red-500'>*</span></label>
              <input type='text' name='name' id='name' required value={name} onChange={(e) => setName(e.target.value)} className='mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white' />
            </div>
          </fieldset>

          <fieldset className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
            <legend className="text-lg font-medium text-gray-900 dark:text-white mb-3">Style Profile</legend>
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>LinkedIn Examples (min. 3)</label>
              {linkedinExampleInputs.map((input, index) => (
                <div key={index} className="flex items-center space-x-2 mb-2">
                  <textarea 
                    id={`linkedinExample-${index}`}
                    value={input} 
                    onChange={(e) => handleExampleInputChange(index, e.target.value)} 
                    rows={2} 
                    className='flex-grow mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white' 
                    placeholder={`Example Post ${index + 1}...`}
                  />
                  {linkedinExampleInputs.length > 3 && (
                    <button type="button" onClick={() => handleRemoveExampleInput(index)} className="p-1 text-red-500 hover:text-red-700">
                      <TiDelete size="20" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={handleAddExampleInput} className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">+ Add Example</button>
            <div>
              <label htmlFor='styleAnalysis' className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>Style Analysis (auto-generated, editable)</label>
              <textarea name='styleAnalysis' id='styleAnalysis' rows={4} value={styleAnalysis} onChange={(e) => setStyleAnalysis(e.target.value)} className='mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white' placeholder='Analysis will be generated after saving changes to LinkedIn examples...'></textarea>
            </div>
          </fieldset>

          <fieldset className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
            <legend className="text-lg font-medium text-gray-900 dark:text-white mb-3">Persona Profile</legend>
            <div><label htmlFor='birthday' className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>Birthday</label><input type='date' name='birthday' id='birthday' value={birthday} onChange={(e) => setBirthday(e.target.value)} className='mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white' /></div>
            <div><label htmlFor='jobDescription' className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>Job Description</label><textarea name='jobDescription' id='jobDescription' rows={3} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} className='mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white'></textarea></div>
            <div><label htmlFor='fieldOfWork' className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>Field of Work</label><input type='text' name='fieldOfWork' id='fieldOfWork' value={fieldOfWork} onChange={(e) => setFieldOfWork(e.target.value)} className='mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white' /></div>
            <div><label htmlFor='customerProfile' className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>Customer Profile Summary</label><textarea name='customerProfile' id='customerProfile' rows={4} value={customerProfile} onChange={(e) => setCustomerProfile(e.target.value)} className='mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white'></textarea></div>
          </fieldset>
          
          <div className="pt-5">
            <button type="submit" disabled={isSubmitting} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50">
              {isSubmitting ? <CgSpinner className="animate-spin mr-2" /> : 'Save Customer Details'}
            </button>
          </div>
        </form>

        {/* Right Column: Subscription Plan Management */}
        <div className="md:col-span-1 space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md self-start">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Subscription Plan</h2>
          {currentPlanDetails ? (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-md">
              <h3 className="font-semibold text-blue-800 dark:text-blue-200">Current Plan: {currentPlanDetails.name}</h3>
              {currentPlanDetails.price && <p className="text-sm text-blue-600 dark:text-blue-300">{currentPlanDetails.price}</p>}
              {currentPlanDetails.dailyCommentLimit && <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">Daily Comment Limit: {currentPlanDetails.dailyCommentLimit}</p>}
              {currentPlanDetails.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{currentPlanDetails.description}</p>}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 mb-4">No active plan or plan details unavailable.</p>
          )}
          
          <div>
            <label htmlFor="plan-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Change Plan:</label>
            <select 
              id="plan-select"
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
            >
              {customerPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} ({plan.price}) - Daily Comments: {plan.dailyCommentLimit}
                </option>
              ))}
            </select>
          </div>
          <button 
            onClick={handlePlanChange} 
            disabled={isUpdatingPlan || selectedPlanId === customer.subscriptionPlan}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isUpdatingPlan ? <CgSpinner className="animate-spin mr-2" /> : 'Update Plan'}
          </button>
          {/* Future: Link to payment processor if plan change requires payment */}
        </div>
      </div>
    </div>
  );
};

export default CustomerDetailsPage; 