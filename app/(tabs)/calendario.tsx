import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  Dimensions,
  Modal,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Heart, ArrowLeft, ChevronLeft, ChevronRight,
  Gift, Calendar as CalendarIcon, Clock, Sparkles, Trash2, Pencil
} from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../lib/supabase';
import { useProfileAndCouple } from '../../lib/useProfileAndCouple';

const { width } = Dimensions.get('window');

// --- Set up notification handler for foreground notifications safely ---
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (e) {
  console.log('Failed to set notification handler:', e);
}

// --- Premium Light / Pastel Theme Palette ---
const PAGE_BG = '#FFFFFF';
const CARD_BG = '#FFFFFF';
const TEXT_PRIMARY = '#222222';
const TEXT_SECONDARY = '#6B7280';
const TEXT_MUTED = '#9CA3AF';
const ACCENT_RED = '#F4A6A6';
const BORDER = '#F1DCDC';
const SOFT_PINK = '#FFF1F2';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const WEEK_DAYS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

export default function CalendarioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, couple, loading } = useProfileAndCouple();
  const [dbLoading, setDbLoading] = useState(false);

  // Preloaded and dynamically added events list
  const [events, setEvents] = useState<any[]>([]);

  // Fetch events from Supabase when couple_id is available
  useEffect(() => {
    if (couple?.couple_id) {
      fetchSupabaseEvents(couple.couple_id);
    }
  }, [couple?.couple_id]);

  const getStylesForType = (type: string) => {
    let color = '#FFF1F2';
    let borderColor = '#F1DCDC';
    let iconColor = '#F4A6A6';

    if (type === 'Recuerdo') {
      color = '#F0F9FF';
      borderColor = '#E0F2FE';
      iconColor = '#64B5F6';
    } else if (type === 'Fecha especial') {
      color = '#FFFDF0';
      borderColor = '#FDF0CD';
      iconColor = '#FFBA08';
    } else if (type === 'Tarea') {
      color = '#F0FDF4';
      borderColor = '#DCFCE7';
      iconColor = '#4ADE80';
    }
    return { color, borderColor, iconColor };
  };

  const fetchSupabaseEvents = async (coupleId: string) => {
    setDbLoading(true);
    try {
      const { data, error } = await supabase
        .from('important_dates')
        .select('*')
        .eq('couple_id', coupleId)
        .order('event_date', { ascending: true });

      if (error) {
        console.error('Error fetching Supabase events:', error);
        return;
      }

      if (data) {
        const mappedEvents = data.map((item: any) => {
          const typeStyles = getStylesForType(item.type);
          return {
            id: item.id,
            title: item.title,
            date: item.event_date || item.date, // Fallback if event_date is null
            description: item.description,
            type: item.type,
            color: item.color || typeStyles.color,
            borderColor: item.border_color || item.borderColor || typeStyles.borderColor,
            iconColor: item.icon_color || item.iconColor || typeStyles.iconColor,
            reminderEnabled: item.reminder_enabled,
            reminderTime: item.event_time || item.time || item.reminder_time || '09:00', // Fallback mapped
            notificationScheduled: !!item.notification_id,
            notificationId: item.notification_id,
          };
        });
        setEvents(mappedEvents);
      }
    } catch (err) {
      console.error('Catch error fetching events:', err);
    } finally {
      setDbLoading(false);
    }
  };

  // Local calendar states
  const [currentDate, setCurrentDate] = useState(new Date(2026, 5, 12)); // Default to June 2026
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(2026, 5, 12)); // Default selected June 12, 2026

  // Modal forms state
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState('Plan');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [newReminderTime, setNewReminderTime] = useState('09:00');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const getDaysGrid = (year: number, month: number) => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const grid = [];
    
    // Days of previous month to fill the first row
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      grid.push({
        day: prevMonthDays - i,
        month: month === 0 ? 11 : month - 1,
        year: month === 0 ? year - 1 : year,
        isCurrentMonth: false,
      });
    }

    // Days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      grid.push({
        day: i,
        month: month,
        year: year,
        isCurrentMonth: true,
      });
    }

    // Days of next month to fill the grid up to 42 cells
    const remaining = 42 - grid.length;
    for (let i = 1; i <= remaining; i++) {
      grid.push({
        day: i,
        month: month === 11 ? 0 : month + 1,
        year: month === 11 ? year + 1 : year,
        isCurrentMonth: false,
      });
    }

    return grid;
  };

  const daysGrid = getDaysGrid(currentYear, currentMonth);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const toDateStr = (y: number, m: number, d: number) => {
    const mm = (m + 1).toString().padStart(2, '0');
    const dd = d.toString().padStart(2, '0');
    return y + '-' + mm + '-' + dd;
  };

  const getEventsForSelectedDay = () => {
    const selectedStr = toDateStr(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    return events.filter(sd => sd.date === selectedStr);
  };

  // Helper to schedule a local notification safely with no push/remote tokens
  const scheduleLocalNotification = async (title: string, body: string, date: Date, timeStr: string): Promise<string | null> => {
    try {
      // Safely request permissions
      let status = 'denied';
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        status = existingStatus;
        if (status !== 'granted') {
          const { status: newStatus } = await Notifications.requestPermissionsAsync();
          status = newStatus;
        }
      } catch (permissionError) {
        console.log('Notification permission request failed:', permissionError);
        return null;
      }

      if (status !== 'granted') {
        console.log('Failed to get notification permission!');
        return null;
      }

      // Parse hours and minutes
      const parts = timeStr.split(':');
      const hours = parseInt(parts[0], 10) || 9;
      const minutes = parseInt(parts[1], 10) || 0;

      const triggerDate = new Date(date);
      triggerDate.setHours(hours, minutes, 0, 0);

      const now = new Date();
      // If time is in the past, return null
      if (triggerDate.getTime() <= now.getTime()) {
        return null;
      }

      try {
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
          },
        });
        return notificationId;
      } catch (scheduleError) {
        console.log('Notification scheduling failed:', scheduleError);
        return null;
      }
    } catch (e) {
      console.error('Outer error scheduling local notification:', e);
      return null;
    }
  };



  const handleSaveEvent = async () => {
    if (!newTitle.trim()) return;
    if (!couple?.couple_id) {
      Alert.alert('Error', 'No se ha encontrado el identificador de pareja.');
      return;
    }

    const dateStr = toDateStr(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());

    let color = '#FFF1F2';
    let borderColor = '#F1DCDC';
    let iconColor = '#F4A6A6';

    if (newType === 'Recuerdo') {
      color = '#F0F9FF';
      borderColor = '#E0F2FE';
      iconColor = '#64B5F6';
    } else if (newType === 'Fecha especial') {
      color = '#FFFDF0';
      borderColor = '#FDF0CD';
      iconColor = '#FFBA08';
    } else if (newType === 'Tarea') {
      color = '#F0FDF4';
      borderColor = '#DCFCE7';
      iconColor = '#4ADE80';
    }

    let notificationScheduled = false;
    let scheduledNotificationId: string | null = null;

    if (reminderEnabled) {
      if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(newReminderTime)) {
        Alert.alert('Hora inválida', 'La hora ingresada no tiene un formato válido (HH:mm) o no existe.');
        return;
      }

      const parts = newReminderTime.split(':');
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);

      const triggerDate = new Date(selectedDate);
      triggerDate.setHours(hours, minutes, 0, 0);

      const now = new Date();
      if (triggerDate.getTime() <= now.getTime()) {
        Alert.alert('Aviso', 'Elige una fecha y hora futura.');
        return; // Blocks saving and keeps modal open for user adjustments
      }

      scheduledNotificationId = await scheduleLocalNotification(
        'Recordatorio especial',
        'Hoy tienen: ' + newTitle,
        selectedDate,
        newReminderTime
      );
      if (scheduledNotificationId) {
        notificationScheduled = true;
      }
    }

    // Detailed debugging logs
    console.log("--- Supabase Save Event Debugging ---");
    console.log("Current User ID:", profile?.id);
    console.log("Couple object:", couple);
    console.log("Couple ID:", couple?.couple_id);
    console.log("Selected Date Str:", dateStr);

    setDbLoading(true);
    try {
      const typeStyles = getStylesForType(newType);

      // Save to all columns including fallback date/time and premium pastel colors
      const insertPayload = {
        couple_id: couple.couple_id,
        title: newTitle.trim(),
        description: newDesc.trim(),
        event_date: dateStr,
        date: dateStr,
        event_time: reminderEnabled ? (newReminderTime.trim() || '09:00') : null,
        time: reminderEnabled ? (newReminderTime.trim() || '09:00') : null,
        type: newType,
        reminder_enabled: reminderEnabled,
        reminder_time: reminderEnabled ? (newReminderTime.trim() || '09:00') : null,
        notification_id: scheduledNotificationId || null,
        created_by: profile?.id || null,
        color: typeStyles.color,
        border_color: typeStyles.borderColor,
        icon_color: typeStyles.iconColor,
      };

      console.log("Exact Insert Payload:", JSON.stringify(insertPayload, null, 2));

      let data, error;

      if (editingEventId) {
        const existingEvent = events.find(e => e.id === editingEventId);
        if (existingEvent?.notificationId && (!reminderEnabled || scheduledNotificationId)) {
          try {
            await Notifications.cancelScheduledNotificationAsync(existingEvent.notificationId);
          } catch(e) {}
        }

        if (reminderEnabled && !scheduledNotificationId && existingEvent?.notificationId) {
           insertPayload.notification_id = existingEvent.notificationId;
           scheduledNotificationId = existingEvent.notificationId;
           notificationScheduled = true;
        }

        const res = await supabase
          .from('important_dates')
          .update(insertPayload)
          .eq('id', editingEventId)
          .select()
          .single();
        data = res.data;
        error = res.error;
      } else {
        const res = await supabase
          .from('important_dates')
          .insert([insertPayload])
          .select()
          .single();
        data = res.data;
        error = res.error;
      }

      if (error) {
        console.error("important_dates save error:", JSON.stringify(error, null, 2));
        Alert.alert('Error', error.message || 'No se pudo guardar el evento en la base de datos.');
        return;
      }

      const insertedRow = data;
      
      const newEvent = {
        id: insertedRow?.id || editingEventId || Date.now().toString(),
        title: newTitle,
        date: dateStr,
        description: newDesc,
        type: newType,
        color: typeStyles.color,
        borderColor: typeStyles.borderColor,
        iconColor: typeStyles.iconColor,
        reminderEnabled,
        reminderTime: reminderEnabled ? (newReminderTime.trim() || '09:00') : null,
        notificationScheduled,
        notificationId: scheduledNotificationId,
      };

      if (editingEventId) {
        setEvents(prev => prev.map(e => e.id === editingEventId ? newEvent : e));
      } else {
        setEvents(prev => [...prev, newEvent]);
      }
      
      setEditingEventId(null);
      setNewTitle('');
      setNewDesc('');
      setNewType('Plan');
      setReminderEnabled(false);
      setNewReminderTime('09:00');
      setModalVisible(false);
    } catch (err) {
      console.error('Catch error saving event:', err);
      Alert.alert('Error', 'Ocurrió un error inesperado al guardar el evento.');
    } finally {
      setDbLoading(false);
    }
  };

  const handleTimeInput = (text: string) => {
    let cleaned = text.replace(/[^0-9]/g, '');
    
    if (cleaned.length > 0) {
      const firstDigit = parseInt(cleaned[0], 10);
      if (firstDigit > 2 && cleaned.length === 1) {
        cleaned = '0' + cleaned;
      }
    }
    
    if (cleaned.length >= 3) {
      cleaned = cleaned.slice(0, 2) + ':' + cleaned.slice(2, 4);
    }
    
    setNewReminderTime(cleaned);
  };

  const handleEditEvent = (event: any) => {
    setEditingEventId(event.id);
    setNewTitle(event.title);
    setNewDesc(event.description || '');
    setNewType(event.type);
    setReminderEnabled(event.reminderEnabled);
    setNewReminderTime(event.reminderTime || '09:00');
    setModalVisible(true);
  };

  const handleDeleteEvent = (eventId: string, notificationId?: string | null) => {
    Alert.alert(
      '¿Eliminar este evento?',
      'Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setDbLoading(true);
            try {
              // Delete from Supabase
              const { error } = await supabase
                .from('important_dates')
                .delete()
                .eq('id', eventId);

              if (error) {
                console.error("Delete error:", error);
                Alert.alert("Error", "No se pudo eliminar el evento.");
                return;
              }

              // Cancel local notification if scheduled
              if (notificationId) {
                try {
                  await Notifications.cancelScheduledNotificationAsync(notificationId);
                  console.log("Cancelled scheduled notification:", notificationId);
                } catch (notifErr) {
                  console.log("Could not cancel notification:", notifErr);
                }
              }

              // Remove from local state immediately
              setEvents(prev => prev.filter(e => e.id !== eventId));
            } catch (err) {
              console.error("Catch delete error:", err);
            } finally {
              setDbLoading(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: PAGE_BG }}>
        <ActivityIndicator size="large" color={ACCENT_RED} />
      </View>
    );
  }

  const activeEvents = getEventsForSelectedDay();

  return (
    <SafeAreaView style={[s.root, { backgroundColor: PAGE_BG }]}>
      <StatusBar style="dark" />
      
      {/* Header section */}
      <View style={[s.header, { paddingTop: Math.max(insets.top, 10) }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft size={22} color={TEXT_PRIMARY} />
        </Pressable>
        <View style={s.headerTitleWrap}>
          <Text style={s.headerTitle}>Calendario</Text>
          <Text style={s.headerSub}>Sus fechas importantes</Text>
        </View>
      </View>

      <ScrollView 
        style={s.scroll} 
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Large Monthly Calendar Card */}
        <View style={s.calendarCard}>
          {/* Header Row */}
          <View style={s.calendarHeader}>
            <Text style={s.monthTitle}>
              {MONTH_NAMES[currentMonth]} {currentYear}
            </Text>
            <View style={s.calendarNavButtons}>
              <Pressable onPress={handlePrevMonth} style={s.navBtn}>
                <ChevronLeft size={20} color={TEXT_PRIMARY} />
              </Pressable>
              <Pressable onPress={handleNextMonth} style={s.navBtn}>
                <ChevronRight size={20} color={TEXT_PRIMARY} />
              </Pressable>
            </View>
          </View>

          {/* Week Days Headers */}
          <View style={s.weekDaysRow}>
            {WEEK_DAYS.map((day) => (
              <Text key={day} style={s.weekDayText}>{day}</Text>
            ))}
          </View>

          {/* Days Grid */}
          <View style={s.daysGrid}>
            {daysGrid.map((item, idx) => {
              const itemDateStr = toDateStr(item.year, item.month, item.day);
              const isSelected = selectedDate.getFullYear() === item.year && 
                                 selectedDate.getMonth() === item.month && 
                                 selectedDate.getDate() === item.day;
              
              const specialEvent = events.find(sd => sd.date === itemDateStr);

              return (
                <Pressable
                  key={idx}
                  style={[
                    s.dayCell,
                    !item.isCurrentMonth && s.dayCellOutside,
                    isSelected && s.dayCellSelected,
                  ]}
                  onPress={() => setSelectedDate(new Date(item.year, item.month, item.day))}
                >
                  <Text
                    style={[
                      s.dayText,
                      !item.isCurrentMonth && s.dayTextOutside,
                      isSelected && s.dayTextSelected,
                    ]}
                  >
                    {item.day}
                  </Text>
                  
                  {/* Event indicator (heart dot) */}
                  {specialEvent && (
                    <View 
                      style={[
                        s.eventDot, 
                        isSelected && s.eventDotSelected,
                        { backgroundColor: specialEvent.iconColor }
                      ]} 
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Selected Day Details Card */}
        <Text style={s.sectionTitle}>Día seleccionado</Text>
        <View style={s.detailsCard}>
          {activeEvents.length > 0 ? (
            <View style={s.activeEventContainer}>
              {activeEvents.map((activeEvent, index) => (
                <View 
                  key={activeEvent.id || index} 
                  style={[
                    index > 0 && { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: BORDER }
                  ]}
                >
                  <View style={[s.eventBadge, { backgroundColor: activeEvent.color, borderColor: activeEvent.borderColor }]}>
                    {activeEvent.type === 'Plan' && <Sparkles size={20} color={activeEvent.iconColor} />}
                    {activeEvent.type === 'Recuerdo' && <Clock size={20} color={activeEvent.iconColor} />}
                    {activeEvent.type === 'Fecha especial' && <Heart size={20} color={activeEvent.iconColor} fill={activeEvent.iconColor} />}
                    {activeEvent.type === 'Tarea' && <CalendarIcon size={20} color={activeEvent.iconColor} />}
                    
                    <View style={[s.eventBadgeTexts, { flex: 1 }]}>
                      <Text style={s.eventBadgeTitle}>{activeEvent.title}</Text>
                      <Text style={s.eventBadgeDate}>
                        {selectedDate.toLocaleDateString('es', { day: 'numeric', month: 'long' })} • {activeEvent.type}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <Pressable 
                        onPress={() => handleEditEvent(activeEvent)}
                        style={({ pressed }) => [{ padding: 4, opacity: pressed ? 0.5 : 1 }]}
                      >
                        <Pencil size={20} color={TEXT_MUTED} />
                      </Pressable>
                      <Pressable 
                        onPress={() => handleDeleteEvent(activeEvent.id, activeEvent.notificationId)}
                        style={({ pressed }) => [{ padding: 4, opacity: pressed ? 0.5 : 1 }]}
                      >
                        <Trash2 size={20} color={TEXT_MUTED} />
                      </Pressable>
                    </View>
                  </View>
                  <Text style={s.eventDescription}>{activeEvent.description}</Text>
                  
                  {/* Local Reminder Badge with Status Text */}
                  {activeEvent.reminderEnabled && activeEvent.reminderTime && (
                    <View style={s.reminderBadgeContainer}>
                      <View style={[s.reminderBadge, { borderColor: activeEvent.borderColor }]}>
                        <Clock size={12} color={activeEvent.iconColor} />
                        <Text style={[s.reminderText, { color: activeEvent.iconColor }]}>
                          Recordatorio: {activeEvent.reminderTime}
                        </Text>
                      </View>
                      <Text 
                        style={[
                          s.reminderStatusText, 
                          !activeEvent.notificationScheduled && { color: TEXT_SECONDARY }
                        ]}
                      >
                        {activeEvent.notificationScheduled ? 'Recordatorio activado' : 'Recordatorio guardado localmente'}
                      </Text>
                    </View>
                  )}
                </View>
              ))}

              <View style={s.btnRow}>
                <Pressable 
                  style={s.addPlanBtn}
                  onPress={() => {
                    setEditingEventId(null);
                    setNewTitle('');
                    setNewDesc('');
                    setNewType('Plan');
                    setReminderEnabled(false);
                    setNewReminderTime('09:00');
                    setModalVisible(true);
                  }}
                >
                  <Text style={s.addPlanBtnText}>Agregar plan</Text>
                </Pressable>

              </View>
            </View>
          ) : (
            <View style={s.emptyEventContainer}>
              <CalendarIcon size={24} color={TEXT_MUTED} />
              <Text style={s.emptyEventText}>
                No hay eventos para el {selectedDate.toLocaleDateString('es', { day: 'numeric', month: 'long' })}.
              </Text>
              
              <View style={s.btnRow}>
                <Pressable 
                  style={s.addPlanBtn}
                  onPress={() => {
                    setEditingEventId(null);
                    setNewTitle('');
                    setNewDesc('');
                    setNewType('Plan');
                    setReminderEnabled(false);
                    setNewReminderTime('09:00');
                    setModalVisible(true);
                  }}
                >
                  <Text style={s.addPlanBtnText}>Agregar plan</Text>
                </Pressable>

              </View>
            </View>
          )}
        </View>

        {/* Fechas Especiales List Section */}
        <Text style={s.sectionTitle}>Fechas especiales</Text>
        <View style={s.listContainer}>
          {events.map((sd) => {
            const dateObj = new Date(sd.date + 'T00:00:00');
            const formattedDate = dateObj.toLocaleDateString('es', { day: 'numeric', month: 'long' });
            
            return (
              <Pressable
                key={sd.id}
                style={[s.specialDateListItem, { backgroundColor: sd.color, borderColor: sd.borderColor }]}
                onPress={() => {
                  setSelectedDate(dateObj);
                  setCurrentDate(dateObj);
                }}
              >
                <View style={[s.listIconWrapper, { backgroundColor: '#FFFFFF' }]}>
                  {sd.type === 'Plan' && <Sparkles size={18} color={sd.iconColor} />}
                  {sd.type === 'Recuerdo' && <Clock size={18} color={sd.iconColor} />}
                  {sd.type === 'Fecha especial' && <Heart size={18} color={sd.iconColor} fill={sd.iconColor} />}
                  {sd.type === 'Tarea' && <CalendarIcon size={18} color={sd.iconColor} />}
                </View>
                <View style={s.listTextWrapper}>
                  <Text style={s.listTitle}>{sd.title}</Text>
                  <Text style={s.listSubtitle}>{formattedDate} • {sd.type}</Text>
                </View>
                <ChevronRight size={18} color={TEXT_SECONDARY} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Modal to add plan */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContainer}>
            <Text style={s.modalTitle}>{editingEventId ? 'Editar evento' : 'Agregar algo para este día'}</Text>
            
            <Text style={s.inputLabel}>Título</Text>
            <TextInput
              style={s.modalInput}
              placeholder="Ej: Nuestro primer día"
              placeholderTextColor={TEXT_MUTED}
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <Text style={s.inputLabel}>Descripción</Text>
            <TextInput
              style={[s.modalInput, s.modalTextArea]}
              placeholder="Escribe una nota o plan especial..."
              placeholderTextColor={TEXT_MUTED}
              value={newDesc}
              onChangeText={setNewDesc}
              multiline
            />

            <Text style={s.inputLabel}>Categoría</Text>
            <View style={s.typeSelectorRow}>
              {['Plan', 'Recuerdo', 'Fecha especial', 'Tarea'].map((type) => {
                const isActive = newType === type;
                return (
                  <Pressable
                    key={type}
                    style={[s.typeChip, isActive && s.typeChipActive]}
                    onPress={() => setNewType(type)}
                  >
                    <Text style={[s.typeChipText, isActive && s.typeChipTextActive]}>{type}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Reminder switch row */}
            <View style={s.switchRow}>
              <Text style={s.switchLabel}>Recordarme este día</Text>
              <Switch
                value={reminderEnabled}
                onValueChange={setReminderEnabled}
                trackColor={{ false: '#E5E7EB', true: ACCENT_RED }}
                thumbColor={reminderEnabled ? '#FFFFFF' : '#F3F4F6'}
              />
            </View>

            {/* Conditional Reminder Time Input */}
            {reminderEnabled && (
              <View style={s.reminderTimeContainer}>
                <Text style={s.inputLabel}>Hora del recordatorio</Text>
                <TextInput
                  style={s.modalInput}
                  placeholder="Ej: 09:00"
                  placeholderTextColor={TEXT_MUTED}
                  value={newReminderTime}
                  onChangeText={handleTimeInput}
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
            )}

            {/* Actions */}
            <View style={s.modalActions}>
              <Pressable 
                style={[s.actionBtn, s.cancelBtn]} 
                onPress={() => setModalVisible(false)}
              >
                <Text style={s.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable 
                style={[s.actionBtn, s.saveBtn]} 
                onPress={handleSaveEvent}
              >
                <Text style={s.saveBtnText}>{editingEventId ? 'Guardar cambios' : 'Guardar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAGE_BG },
  scroll: { flex: 1, paddingHorizontal: 20 },
  
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    marginBottom: 20,
    gap: 16,
  },
  backBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: SOFT_PINK, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: TEXT_PRIMARY },
  headerSub: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 2 },

  calendarCard: {
    backgroundColor: CARD_BG,
    borderRadius: 32,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
    marginBottom: 24,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  calendarNavButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  weekDayText: {
    width: (width - 72) / 7,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
    color: TEXT_MUTED,
    textTransform: 'uppercase',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dayCell: {
    width: (width - 72) / 7,
    height: (width - 72) / 7,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    marginBottom: 6,
    position: 'relative',
  },
  dayCellOutside: {
    opacity: 0.3,
  },
  dayCellSelected: {
    backgroundColor: SOFT_PINK,
    borderWidth: 1,
    borderColor: ACCENT_RED,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  dayTextOutside: {
    color: TEXT_MUTED,
  },
  dayTextSelected: {
    color: ACCENT_RED,
    fontWeight: '900',
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    position: 'absolute',
    bottom: 6,
  },
  eventDotSelected: {
    backgroundColor: ACCENT_RED,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  detailsCard: {
    backgroundColor: CARD_BG,
    borderRadius: 32,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
    marginBottom: 24,
  },
  activeEventContainer: {
    alignItems: 'stretch',
  },
  eventBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
  },
  eventBadgeTexts: {
    flex: 1,
  },
  eventBadgeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  eventBadgeDate: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  eventDescription: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 18,
    fontStyle: 'italic',
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  emptyEventContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  emptyEventText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    textAlign: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
  },
  addPlanBtn: {
    backgroundColor: SOFT_PINK,
    borderWidth: 1,
    borderColor: ACCENT_RED,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'center',
  },
  addPlanBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: ACCENT_RED,
  },

  listContainer: {
    gap: 12,
  },
  specialDateListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
  },
  listIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listTextWrapper: {
    flex: 1,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  listSubtitle: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: CARD_BG,
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: TEXT_PRIMARY,
    marginBottom: 20,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  modalInput: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: TEXT_PRIMARY,
    marginBottom: 16,
  },
  modalTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  typeSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  typeChip: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  typeChipActive: {
    backgroundColor: SOFT_PINK,
    borderColor: ACCENT_RED,
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_SECONDARY,
  },
  typeChipTextActive: {
    color: ACCENT_RED,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  actionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
    minWidth: 90,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: BORDER,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_SECONDARY,
  },
  saveBtn: {
    backgroundColor: SOFT_PINK,
    borderWidth: 1,
    borderColor: ACCENT_RED,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: ACCENT_RED,
  },

  // Reminder badge container styles
  reminderBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  reminderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reminderText: {
    fontSize: 11,
    fontWeight: '800',
  },
  reminderStatusText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '700',
  },
  reminderTimeContainer: {
    marginBottom: 16,
  },
});