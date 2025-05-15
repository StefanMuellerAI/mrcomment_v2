import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useAction } from 'wasp/client/operations';
import { getScheduledPostsForCustomer } from 'wasp/client/operations'; // Only this query is used inside the modal for fetching posts when scheduling from calendar
import type { Customer, LinkedInPost, Schedule } from 'wasp/entities';
import { CgSpinner } from 'react-icons/cg';
import { FiAlertCircle } from 'react-icons/fi';

// Data type for posts in the list, consistent with backend and used by the modal
export type PostWithOptionalSchedule = LinkedInPost & { schedule?: Schedule | null };

// Props for the ScheduleModal component
export interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Pick<Customer, 'id' | 'name'>[] | undefined;
  isLoadingCustomers: boolean | null | undefined; // Allow null, boolean, or undefined
  selectedPostForScheduling: PostWithOptionalSchedule | null;
  selectedDateFromCalendar: Date | null;
  globalSelectedCustomerId: string; 
  setScheduleMutation: ReturnType<typeof useAction<any, any>>;
  refetchPostsForCustomer: () => void; // Generic name for refetching the list that opened the modal
  refetchSchedulesForMonth: () => void; // For refetching calendar data if needed
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen,
  onClose,
  customers,
  isLoadingCustomers,
  selectedPostForScheduling,
  selectedDateFromCalendar,
  globalSelectedCustomerId,
  setScheduleMutation,
  refetchPostsForCustomer,
  refetchSchedulesForMonth,
}) => {
  if (!isOpen) return null;

  const [modalSelectedDate, setModalSelectedDate] = useState<string>('');
  const [modalSelectedTime, setModalSelectedTime] = useState<string>('10:00');
  const [modalEnableReminder, setModalEnableReminder] = useState<boolean>(false);
  const [modalReminderMinutes, setModalReminderMinutes] = useState<number>(15);
  const [modalErrorState, setModalErrorState] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [modalCustomerIdState, setModalCustomerIdState] = useState<string>('');
  const [modalPostIdState, setModalPostIdState] = useState<string>('');
  const today_YYYY_MM_DD = new Date().toISOString().split('T')[0];

  const isPastAndNotPosted = !!(selectedPostForScheduling?.schedule && 
                               new Date(selectedPostForScheduling.schedule.postingDate) < new Date(today_YYYY_MM_DD) && 
                               !selectedPostForScheduling.schedule.isPosted);
  const isPosted = !!selectedPostForScheduling?.schedule?.isPosted;
  const isDisabled = isPosted || isPastAndNotPosted;

  useEffect(() => {
    if (isOpen) {
      setModalErrorState(null);
      setIsSaving(false); // Reset saving state when modal opens

      if (selectedPostForScheduling) {
        setModalCustomerIdState(selectedPostForScheduling.customerId);
        setModalPostIdState(selectedPostForScheduling.id);

        if (selectedPostForScheduling.schedule) {
          const { schedule } = selectedPostForScheduling;
          const postingDate = new Date(schedule.postingDate);
          setModalSelectedDate(postingDate.toISOString().split('T')[0]);
          setModalSelectedTime(postingDate.toTimeString().substring(0,5));
          setModalEnableReminder(schedule.reminderInMinutes != null);
          setModalReminderMinutes(schedule.reminderInMinutes || 15);
        } else {
          // Post exists but no schedule, set defaults or use calendar date if available
          if (selectedDateFromCalendar) { // This case should ideally not happen if selectedPostForScheduling is present
            const year = selectedDateFromCalendar.getFullYear();
            const month = (selectedDateFromCalendar.getMonth() + 1).toString().padStart(2, '0');
            const day = selectedDateFromCalendar.getDate().toString().padStart(2, '0');
            setModalSelectedDate(`${year}-${month}-${day}`);
          } else {
            // Default to today if scheduling an unscheduled post without calendar context
            setModalSelectedDate(today_YYYY_MM_DD);
          }
          setModalSelectedTime('10:00');
          setModalEnableReminder(false);
          setModalReminderMinutes(15);
        }
      } else if (selectedDateFromCalendar) {
        // Scheduling from calendar (no specific post pre-selected)
        const year = selectedDateFromCalendar.getFullYear();
        const month = (selectedDateFromCalendar.getMonth() + 1).toString().padStart(2, '0');
        const day = selectedDateFromCalendar.getDate().toString().padStart(2, '0');
        setModalSelectedDate(`${year}-${month}-${day}`);
        setModalSelectedTime('10:00');
        setModalEnableReminder(false);
        setModalReminderMinutes(15);
        setModalCustomerIdState(globalSelectedCustomerId || '');
        setModalPostIdState(''); // No post selected yet
      } else {
        // Fallback: No context (should ideally not happen if modal is opened correctly)
        setModalSelectedDate(today_YYYY_MM_DD);
        setModalSelectedTime('10:00');
        setModalEnableReminder(false);
        setModalReminderMinutes(15);
        setModalCustomerIdState(globalSelectedCustomerId || '');
        setModalPostIdState('');
      }
    }
  }, [isOpen, selectedPostForScheduling, selectedDateFromCalendar, globalSelectedCustomerId, today_YYYY_MM_DD]);

  const modalPostsQueryArgs = useMemo(() => ({ customerId: modalCustomerIdState }), [modalCustomerIdState]);
  const { data: postsForModalDropdown, isLoading: isLoadingPostsForModalDropdown, error: postsForModalDropdownError } = useQuery(
      getScheduledPostsForCustomer, 
      modalPostsQueryArgs, 
      { enabled: !!modalCustomerIdState && !!selectedDateFromCalendar && !selectedPostForScheduling }
  );

  const handleSubmitSchedule = async () => {
    setModalErrorState(null);
    
    const targetPostId = selectedPostForScheduling ? selectedPostForScheduling.id : modalPostIdState;
    const customerIdForSubmit = selectedPostForScheduling ? selectedPostForScheduling.customerId : modalCustomerIdState;

    if (selectedDateFromCalendar && !selectedPostForScheduling && !customerIdForSubmit) { 
        setModalErrorState('Please select a customer.');
        return;
    }
    if (!targetPostId) {
      setModalErrorState('Please select a post to schedule.');
      return;
    }
    if (!modalSelectedDate || !modalSelectedTime) {
      setModalErrorState('Please select a date and time.');
      return;
    }

    setIsSaving(true);
    const [hours, minutes] = modalSelectedTime.split(':').map(Number);
    const postingDateTime = new Date(modalSelectedDate);
    postingDateTime.setHours(hours, minutes, 0, 0); 

    try {
      await setScheduleMutation({
        linkedInPostId: targetPostId,
        postingDate: postingDateTime,
        reminderInMinutes: modalEnableReminder ? modalReminderMinutes : null,
      });
      onClose(); 
      refetchPostsForCustomer(); 
      refetchSchedulesForMonth();
    } catch (err: any) {
      setModalErrorState(err.message || 'Failed to save schedule.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
      <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm'>
        <div className='bg-white dark:bg-boxdark rounded-lg shadow-xl p-6 w-full max-w-lg space-y-4 overflow-y-auto max-h-[90vh]'>
          <h3 className='text-xl font-semibold text-gray-800 dark:text-white'>
            {selectedPostForScheduling ? `Schedule Post` : `Schedule for ${modalSelectedDate ? new Date(modalSelectedDate + 'T00:00:00').toLocaleDateString() : 'selected date'}`}
          </h3>
          {selectedPostForScheduling && <p className='text-sm text-gray-600 dark:text-gray-400 truncate'>Post: {selectedPostForScheduling.hook}</p>}

          {modalErrorState && (
            <div className='bg-red-100 border-l-4 border-red-500 text-red-700 p-3 my-2 text-sm' role='alert'>
              <div className='flex items-center'>
                <FiAlertCircle className='mr-2'/> <p>{modalErrorState}</p>
              </div>
            </div>
          )}
          
          {/* Logic for selecting customer and post IF scheduling from calendar (no pre-selected post) */}
          {selectedDateFromCalendar && !selectedPostForScheduling && (
            <>
              <div>
                <label htmlFor='modalCustomer' className='block text-sm font-medium text-gray-700 dark:text-gray-300'>Customer</label>
                <select 
                  id='modalCustomer' 
                  value={modalCustomerIdState} 
                  onChange={(e) => { setModalCustomerIdState(e.target.value); setModalPostIdState(''); }}
                  className='mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white'
                  disabled={!!isLoadingCustomers}
                >
                  <option value=''>-- Select Customer --</option>
                  {customers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {modalCustomerIdState && (
                <div>
                  <label htmlFor='modalPost' className='block text-sm font-medium text-gray-700 dark:text-gray-300 mt-2'>Post</label>
                  <select 
                    id='modalPost' 
                    value={modalPostIdState} 
                    onChange={(e) => setModalPostIdState(e.target.value)}
                    className='mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white'
                    disabled={isLoadingPostsForModalDropdown || !postsForModalDropdown}
                  >
                    <option value=''>-- Select Post --</option>
                    {isLoadingPostsForModalDropdown && <option disabled>Loading posts...</option>}
                    {postsForModalDropdownError && <option disabled>Error loading posts</option>}
                    {postsForModalDropdown?.map(p => <option key={p.id} value={p.id}>{p.hook.substring(0,70)}...</option>)} 
                  </select>
                </div>
              )}
            </>
          )}

          {/* Date and Time Pickers */}
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label htmlFor='scheduleDate' className='block text-sm font-medium text-gray-700 dark:text-gray-300'>Date</label>
              <input 
                type='date' 
                id='scheduleDate' 
                value={modalSelectedDate} 
                onChange={e => setModalSelectedDate(e.target.value)} 
                disabled={isDisabled}
                min={today_YYYY_MM_DD}
                className='mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-600' />
            </div>
            <div>
              <label htmlFor='scheduleTime' className='block text-sm font-medium text-gray-700 dark:text-gray-300'>Time</label>
              <input 
                type='time' 
                id='scheduleTime' 
                value={modalSelectedTime} 
                onChange={e => setModalSelectedTime(e.target.value)} 
                disabled={isDisabled}
                className='mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-600' />
            </div>
          </div>

          {/* Reminder Options */}
          <div className='flex items-center pt-2'>
            <input 
              type='checkbox' 
              id='enableReminder' 
              checked={modalEnableReminder} 
              onChange={e => setModalEnableReminder(e.target.checked)} 
              disabled={isDisabled}
              className='h-4 w-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500 disabled:opacity-70' />
            <label htmlFor='enableReminder' className='ml-2 block text-sm text-gray-900 dark:text-gray-300'>Send Reminder</label>
          </div>
          {modalEnableReminder && (
            <div>
              <label htmlFor='reminderMinutes' className='block text-sm font-medium text-gray-700 dark:text-gray-300'>Remind Me Before</label>
              <select 
                id='reminderMinutes' 
                value={modalReminderMinutes} 
                onChange={e => setModalReminderMinutes(Number(e.target.value))} 
                disabled={isDisabled}
                className='mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-600'
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </div>
          )}

          {/* Action Buttons */}
          <div className='flex justify-end space-x-3 pt-4'>
            <button 
              onClick={onClose} 
              className='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md shadow-sm'
            >
              Cancel
            </button>
            <button 
              onClick={handleSubmitSchedule} 
              disabled={isSaving || isDisabled}
              className='px-4 py-2 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded-md shadow-sm disabled:opacity-70 flex items-center'
            >
              {isSaving && <CgSpinner className='animate-spin mr-2'/>}  
              Save Schedule
            </button>
          </div>
        </div>
      </div>
  );
};

export default ScheduleModal; 