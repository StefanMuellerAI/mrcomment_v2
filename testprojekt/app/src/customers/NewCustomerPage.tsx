import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createCustomer } from 'wasp/client/operations';
import { CgSpinner } from 'react-icons/cg';
import { TiDelete } from 'react-icons/ti';

const NewCustomerPage: React.FC = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  // Style fields
  const [linkedinExampleInputs, setLinkedinExampleInputs] = useState<string[]>(['', '', '']); // State for multiple inputs
  // const [styleAnalysis, setStyleAnalysis] = useState(''); // Removed state
  // Persona fields
  const [birthday, setBirthday] = useState(''); // YYYY-MM-DD
  const [jobDescription, setJobDescription] = useState('');
  const [fieldOfWork, setFieldOfWork] = useState('');
  const [customerProfile, setCustomerProfile] = useState('');

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
    if (linkedinExampleInputs.length > 3) { // Only remove if more than 3
      const updatedInputs = linkedinExampleInputs.filter((_, i) => i !== index);
      setLinkedinExampleInputs(updatedInputs);
    }
  };

  // Memoize the count of valid examples for disabling the button
  const validExampleCount = useMemo(() => {
      return linkedinExampleInputs.map(s => s.trim()).filter(s => s).length;
  }, [linkedinExampleInputs]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    // Frontend validation for minimum 3 examples
    const examplesToSave = linkedinExampleInputs.map(s => s.trim()).filter(s => s);
    if (examplesToSave.length < 3) {
      setError('Please provide at least 3 non-empty LinkedIn examples.');
      return; // Prevent submission
    }

    setIsSubmitting(true);
    try {
      const styleData = {
        linkedinExamples: examplesToSave,
        // styleAnalysis, // Analysis is generated backend
      };
      const personaData = {
        birthday: birthday ? new Date(birthday) : undefined,
        jobDescription,
        fieldOfWork,
        customerProfile,
      };

      await createCustomer({
        name,
        styleData, // Always send styleData if it has examples (validation passed)
        personaData: Object.values(personaData).some(v => v) ? personaData : undefined,
      });
      navigate('/customers');
    } catch (err: any) {
      setError(err.message || 'Failed to create customer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='p-4 md:p-8'>
      <div className='flex justify-between items-center mb-8'>
        <h1 className='text-3xl font-bold text-gray-800 dark:text-white'>Create New Customer</h1>
        <Link to='/customers' className='text-blue-600 hover:underline dark:text-blue-400'>
          Back to Customers
        </Link>
      </div>

      {error && (
        <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4' role='alert'>
          <strong className='font-bold'>Error: </strong>
          <span className='block sm:inline'>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className='space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md'>
        {/* Customer Name */}
        <div>
          <label htmlFor='name' className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
            Customer Name <span className='text-red-500'>*</span>
          </label>
          <input
            type='text'
            name='name'
            id='name'
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className='mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white'
          />
        </div>

        {/* Style Information */}
        <fieldset className='border p-4 rounded-md border-gray-300 dark:border-gray-600'>
          <legend className='text-lg font-medium text-gray-900 dark:text-white px-2'>Style <span className='text-red-500'>*</span></legend>
          <div className='space-y-4 mt-2'>
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                LinkedIn Examples (min. 3 required)
              </label>
              {linkedinExampleInputs.map((example, index) => (
                <div key={index} className='flex items-start space-x-2 mb-2'>
                  <textarea
                    name={`linkedinExample-${index}`}
                    id={`linkedinExample-${index}`}
                    rows={3}
                    placeholder={`Example Post ${index + 1}...`}
                    value={example}
                    onChange={(e) => handleExampleInputChange(index, e.target.value)}
                    className='flex-grow block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white'
                  />
                  {index >= 3 && ( // Show remove button only for inputs beyond the first 3
                    <button
                      type="button"
                      onClick={() => handleRemoveExampleInput(index)}
                      title="Remove Example"
                      className='p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200 mt-1' // Adjusted margin
                    >
                      <TiDelete size='20' />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddExampleInput}
                className='mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300'
              >
                + Add Another Example
              </button>
            </div>
          </div>
        </fieldset>
        
        {/* Persona Information */}
        <fieldset className='border p-4 rounded-md border-gray-300 dark:border-gray-600'>
          <legend className='text-lg font-medium text-gray-900 dark:text-white px-2'>Persona (Optional)</legend>
          <div className='space-y-4 mt-2'>
            <div>
              <label htmlFor='birthday' className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                Birthday
              </label>
              <input
                type='date' // Use date input for better UX
                name='birthday'
                id='birthday'
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className='mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white'
              />
            </div>
            <div>
              <label htmlFor='jobDescription' className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                Job Description
              </label>
              <input
                type='text'
                name='jobDescription'
                id='jobDescription'
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className='mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white'
              />
            </div>
            <div>
              <label htmlFor='fieldOfWork' className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                Field of Work
              </label>
              <input
                type='text'
                name='fieldOfWork'
                id='fieldOfWork'
                value={fieldOfWork}
                onChange={(e) => setFieldOfWork(e.target.value)}
                className='mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white'
              />
            </div>
            <div>
              <label htmlFor='customerProfile' className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                Customer Profile (Details, Goals, Challenges)
              </label>
              <textarea
                name='customerProfile'
                id='customerProfile'
                rows={4}
                value={customerProfile}
                onChange={(e) => setCustomerProfile(e.target.value)}
                className='mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white'
              />
            </div>
          </div>
        </fieldset>

        <div>
          <button
            type='submit'
            disabled={isSubmitting || !name.trim() || validExampleCount < 3}
            className='w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {isSubmitting ? (
              <>
                <CgSpinner className='animate-spin mr-2 text-xl' />
                Creating...
              </>
            ) : (
              'Create Customer'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewCustomerPage; 