import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useAction } from 'wasp/client/operations';
import { getAllCustomersForSelection, getScheduledPostsForCustomer, setPostSchedule, deletePostSchedule, getSchedulesByDateRange } from 'wasp/client/operations';
import type { Customer, LinkedInPost, Schedule } from 'wasp/entities';
import { CgSpinner } from 'react-icons/cg';
import { FaRegClock, FaTrashAlt } from 'react-icons/fa';
import { FiChevronLeft, FiChevronRight, FiAlertCircle } from 'react-icons/fi';
import ScheduleModal, { type ScheduleModalProps, type PostWithOptionalSchedule } from './components/ScheduleModal'; // Import the new modal

// Type for schedules that include post and customer information, for the calendar
type ScheduleWithPostAndCustomer = Schedule & { linkedInPost: LinkedInPost & { customer: Customer } };

// const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // Not used anymore in this file

const SchedulePage: React.FC = () => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [currentDate, setCurrentDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedPostForScheduling, setSelectedPostForScheduling] = useState<PostWithOptionalSchedule | null>(null);
  const [selectedDateFromCalendar, setSelectedDateFromCalendar] = useState<Date | null>(null);
  const [isDeletingSchedule, setIsDeletingSchedule] = useState(false);
  const [postCurrentlyDeleting, setPostCurrentlyDeleting] = useState<string | null>(null);
  const [schedulesForMonth, setSchedulesForMonth] = useState<ScheduleWithPostAndCustomer[]>([]);
  const [isLoadingSchedulesForMonth, setIsLoadingSchedulesForMonth] = useState(false);
  const [schedulesError, setSchedulesError] = useState<Error | null>(null);

  const { data: customers, isLoading: isLoadingCustomersInitial, error: customersError } = 
    useQuery(getAllCustomersForSelection);
  const isLoadingCustomers: boolean = !!isLoadingCustomersInitial; // Explicitly type as boolean

  const postsQueryArgs = useMemo(() => ({ customerId: selectedCustomerId }), [selectedCustomerId]);
  const { data: postsForCustomer, isLoading: isLoadingPosts, error: postsError, refetch: refetchPostsForCustomer } = useQuery(
    getScheduledPostsForCustomer, 
    postsQueryArgs, 
    { enabled: !!selectedCustomerId }
  );

  const startOfMonth = useMemo(() => new Date(currentDate.getFullYear(), currentDate.getMonth(), 1), [currentDate]);
  const endOfMonth = useMemo(() => new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999), [currentDate]);

  const schedulesQueryArgsForCalendar = useMemo(() => ({
    startDate: startOfMonth,
    endDate: endOfMonth,
  }), [startOfMonth, endOfMonth]);

  const { 
    data: rawSchedulesForMonth, 
    isLoading: loadingSchedules, 
    error: errorSchedules, 
    refetch: refetchSchedulesForMonth 
  } = useQuery(getSchedulesByDateRange, 
    schedulesQueryArgsForCalendar, 
    { enabled: true } 
  );

  useEffect(() => {
    if (rawSchedulesForMonth) {
      setSchedulesForMonth(rawSchedulesForMonth as ScheduleWithPostAndCustomer[]);
    }
    setIsLoadingSchedulesForMonth(loadingSchedules);
    setSchedulesError(errorSchedules);
  }, [rawSchedulesForMonth, loadingSchedules, errorSchedules]);

  const setScheduleMutation = useAction(setPostSchedule);
  const deleteScheduleMutation = useAction(deletePostSchedule);

  const handleOpenScheduleModalForPost = (post: PostWithOptionalSchedule) => {
    setSelectedPostForScheduling(post);
    setSelectedDateFromCalendar(null); 
    setIsScheduleModalOpen(true);
  };

  const handleOpenScheduleModalFromCalendar = (date: Date) => {
    setSelectedDateFromCalendar(date);
    setSelectedPostForScheduling(null); 
    setIsScheduleModalOpen(true);
  }

  const handleDeleteSchedule = async (linkedInPostId: string) => {
    setPostCurrentlyDeleting(linkedInPostId);
    setIsDeletingSchedule(true);
    try {
      await deleteScheduleMutation({ linkedInPostId });
      refetchPostsForCustomer();
      refetchSchedulesForMonth();
    } catch (err: any) {
      alert('Error deleting schedule: ' + (err.message || 'Unknown error'));
    }
    setIsDeletingSchedule(false);
    setPostCurrentlyDeleting(null);
  };
  
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const renderCalendar = () => {
    const monthName = currentDate.toLocaleString('default', { month: 'long' });
    const year = currentDate.getFullYear();

    const firstDayOfCurrentCalendarMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const firstDayOfTodayMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const disablePrevMonthButton = firstDayOfCurrentCalendarMonth <= firstDayOfTodayMonth;

    const daysInMonth = new Date(year, currentDate.getMonth() + 1, 0).getDate();
    const monthDays: Date[] = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const dayDate = new Date(year, currentDate.getMonth(), i);
      dayDate.setHours(0,0,0,0);
      monthDays.push(dayDate);
    }

    const futureOrTodayMonthDays = monthDays.filter(day => day >= today);

    return (
      <div className='bg-white dark:bg-boxdark-2 p-3 md:p-4 rounded-lg shadow-md'>
        <div className='flex justify-between items-center mb-4 px-1'>
          <button 
            onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} 
            className={`p-2 rounded-md ${disablePrevMonthButton ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
            disabled={disablePrevMonthButton}
            title={disablePrevMonthButton ? 'Cannot go to past months' : 'Previous month'}
          >
            <FiChevronLeft className='h-5 w-5 md:h-6 md:w-6' />
          </button>
          <h2 className='text-lg md:text-xl font-semibold text-gray-800 dark:text-white'>{monthName} {year}</h2>
          <button onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} className='p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300' title='Next month'>
            <FiChevronRight className='h-5 w-5 md:h-6 md:w-6' />
          </button>
        </div>

        <div className='space-y-3'>
          {isLoadingSchedulesForMonth && <div className='flex justify-center p-4'><CgSpinner className='animate-spin text-xl text-blue-500'/></div>}
          {schedulesError && <p className='text-red-500 text-sm text-center p-2'>Error loading schedules: {schedulesError.message}</p>}
          {!isLoadingSchedulesForMonth && !schedulesError && futureOrTodayMonthDays.length === 0 && currentDate >= today && (
             <p className='text-sm text-gray-500 dark:text-gray-400 text-center py-4'>No upcoming days to display for this month.</p>
          )}
          {!isLoadingSchedulesForMonth && !schedulesError && futureOrTodayMonthDays.map((day) => {
            const daySchedules = schedulesForMonth?.filter(
              s => new Date(s.postingDate).toDateString() === day.toDateString()
            ) || [];
            
            const isCurrentDay = day.toDateString() === today.toDateString();
            const dayOfWeekString = day.toLocaleDateString('default', { weekday: 'short' });

            return (
              <div 
                key={day.toISOString()} 
                className={`p-3 rounded-md border dark:border-gray-700 ${isCurrentDay ? 'bg-yellow-50 dark:bg-yellow-700/20 border-yellow-300 dark:border-yellow-600' : 'bg-gray-50 dark:bg-boxdark/50'}`}
              >
                <div className='flex justify-between items-center mb-2'>
                  <div>
                    <span className={`font-semibold text-sm md:text-base ${isCurrentDay ? 'text-yellow-700 dark:text-yellow-300' : 'text-gray-800 dark:text-gray-100'}`}>
                      {day.getDate()}. {dayOfWeekString}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleOpenScheduleModalFromCalendar(day)} 
                    className={`p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400`}
                    title={'Schedule new post for this day'}
                  >
                    <FaRegClock size={16}/>
                  </button>
                </div>
                {daySchedules.length > 0 ? (
                  <div className='space-y-1.5 pl-1'>
                    {daySchedules.map(scheduleItem => {
                      const postForModal: PostWithOptionalSchedule = {
                        ...scheduleItem.linkedInPost,
                        schedule: scheduleItem,      
                      };
                      return (
                        <div 
                          key={scheduleItem.linkedInPostId} 
                          className={`group bg-blue-100 dark:bg-blue-600/50 p-2 rounded text-blue-700 dark:text-blue-200 text-xs flex justify-between items-center cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-700/70`}
                          title={`${scheduleItem.linkedInPost.customer.name}: ${scheduleItem.linkedInPost.hook}`}
                        >
                          <div onClick={() => handleOpenScheduleModalForPost(postForModal)} className={`flex-grow truncate`}>
                            <div>
                              <span className='font-semibold'>{new Date(scheduleItem.postingDate).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12: false})}</span> - 
                              {scheduleItem.linkedInPost.hook.substring(0,30)}{scheduleItem.linkedInPost.hook.length > 30 ? '...' : ''}
                              <span className='text-gray-500 dark:text-gray-400 ml-1'>({scheduleItem.linkedInPost.customer.name})</span>
                            </div>
                            {scheduleItem.reminderInMinutes && (
                              <div className='text-[0.65rem] text-gray-600 dark:text-gray-400 italic'>
                                Reminder: {scheduleItem.reminderInMinutes} min
                              </div>
                            )}
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteSchedule(scheduleItem.linkedInPostId); }}
                            title='Unschedule Post'
                            disabled={!!(postCurrentlyDeleting === scheduleItem.linkedInPostId)} 
                            className='ml-2 p-1 text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 rounded-md hover:bg-red-100 dark:hover:bg-red-700/50 transition-opacity'
                          >
                            {(postCurrentlyDeleting === scheduleItem.linkedInPostId) ? <CgSpinner className='animate-spin h-3 w-3'/> : <FaTrashAlt size={12}/>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className={`text-xs text-gray-400 dark:text-gray-500 pl-1`}>No posts scheduled.</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className='p-4 md:p-8 max-w-full mx-auto'>
      <h1 className='text-3xl font-bold text-gray-800 dark:text-white mb-8 text-center'>Content Schedule</h1>

      {(customersError || postsError || schedulesError) && (
        <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 col-span-full' role='alert'>
          Error: {customersError?.message || postsError?.message || schedulesError?.message}
        </div>
      )}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
        {/* Left Column: Customer Posts List */}
        <div className='space-y-6'>
          <div>
            <label htmlFor='customerSelect' className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
              Select Customer
            </label>
            <select 
              id='customerSelect'
              value={selectedCustomerId}
              onChange={e => setSelectedCustomerId(e.target.value)}
              disabled={isLoadingCustomers}
              className='mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white disabled:opacity-50'
            >
              <option value="">-- Select Customer --</option>
              {isLoadingCustomers && <option disabled>Loading customers...</option>}
              {customers
                ?.filter(customer => customer.subscriptionPlan === 'premium_tier')
                .map(customer => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
          </div>

          {selectedCustomerId && (
            isLoadingPosts ? (
              <div className='flex justify-center items-center h-32'><CgSpinner className='animate-spin text-2xl text-gray-500' /></div>
            ) : postsForCustomer && postsForCustomer.length > 0 ? (
              <div className='space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto pr-2'> 
                {postsForCustomer.map((post: PostWithOptionalSchedule) => (
                  <div key={post.id} className='bg-white dark:bg-boxdark-2 p-3 rounded-lg shadow flex justify-between items-center'>
                    <div className='flex-grow pr-2 overflow-hidden'>
                      <p className='text-sm text-gray-800 dark:text-gray-200 font-medium truncate'>{post.hook}</p>
                      {post.schedule ? (
                        <div className='text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center'>
                          <FaRegClock className="mr-1.5" />
                          <span>Scheduled: {new Date(post.schedule.postingDate).toLocaleString([], {dateStyle: 'medium', timeStyle: 'short'})}</span>
                          {post.schedule.reminderInMinutes && <span className='ml-2 italic'>(Reminder: {post.schedule.reminderInMinutes}m)</span>}
                          <button 
                            onClick={() => handleDeleteSchedule(post.id)}
                            title='Unschedule Post'
                            disabled={!!( !!(postCurrentlyDeleting === post.id) || post.schedule.isPosted || (new Date(post.schedule.postingDate) < new Date() && !post.schedule.isPosted) )}
                            className='ml-3 p-1 text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 rounded-md hover:bg-red-100 dark:hover:bg-red-700/50 transition-colors disabled:opacity-50'
                          >
                            {(postCurrentlyDeleting === post.id) ? <CgSpinner className='animate-spin h-3 w-3'/> : <FaTrashAlt size={12}/>}
                          </button>
                        </div>
                      ) : (
                        <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>Not scheduled</p>
                      )}
                    </div>
                    <button 
                      onClick={() => handleOpenScheduleModalForPost(post)}
                      title={post.schedule ? (post.schedule.isPosted ? 'Already Posted' : (new Date(post.schedule.postingDate) < new Date() && !post.schedule.isPosted ? 'Scheduling date passed' : 'Edit Schedule')) : 'Schedule Post'}
                      disabled={!!(post.schedule?.isPosted || (post.schedule && new Date(post.schedule.postingDate) < new Date() && !post.schedule.isPosted))}
                      className='p-1.5 text-gray-500 hover:text-yellow-600 dark:text-gray-400 dark:hover:text-yellow-500 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      <FaRegClock size={18}/>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className='text-sm text-gray-500 dark:text-gray-400 mt-4'>No posts found for this customer.</p>
            )
          )}
        </div>

        {/* Right Column: Calendar */}
        <div>
          {renderCalendar()} 
        </div>
      </div>
      <ScheduleModal 
        isOpen={isScheduleModalOpen} 
        onClose={() => setIsScheduleModalOpen(false)}
        customers={customers}
        isLoadingCustomers={isLoadingCustomers}
        selectedPostForScheduling={selectedPostForScheduling}
        selectedDateFromCalendar={selectedDateFromCalendar}
        globalSelectedCustomerId={selectedCustomerId}
        setScheduleMutation={setScheduleMutation}
        refetchPostsForCustomer={refetchPostsForCustomer}
        refetchSchedulesForMonth={refetchSchedulesForMonth}
      />
    </div>
  );
};

export default SchedulePage; 