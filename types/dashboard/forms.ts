import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type { Client, Professional, Service } from './entities';

/** Data and callbacks accepted by dashboard form cards. */
export interface BookingFormData {
  /** Explicitly present so React state setters remain assignable across the form. */
  clientId: string | undefined;
  name_complete: string;
  num_phone: string;
  email: string;
  service_id: string;
  /** Optional because existing booking state can be created before birth date is collected. */
  birth_date?: string;
}

export interface BookingFormProps {
  clients: Client[];
  services: Service[];
  professionals: Professional[];
  loading: boolean;
  formData: BookingFormData;
  setFormData: (
    data: BookingFormData | ((prev: BookingFormData) => BookingFormData),
  ) => void;
  selectedProfessionalId: string;
  setSelectedProfessionalId: (id: string) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  selectedTime: string;
  setSelectedTime: (time: string) => void;
  onSubmit: (event: FormEvent) => void;
}

export interface BlockFormData {
  professional_id: string;
  start_date: string;
  start_time: string;
  end_time: string;
  reason: string;
}
export interface BlockScheduleFormProps {
  professionals: Professional[];
  loading: boolean;
  blockFormData: BlockFormData;
  setBlockFormData: (data: BlockFormData) => void;
  onSubmit: (event: FormEvent) => void;
}
export interface ProfessionalsListCardProps {
  professionalsCount: number;
  professionals: Professional[];
  showAddProfessionalForm: boolean;
  setShowAddProfessionalForm: (value: boolean) => void;
  newProfessionalData: { name: string; commission_percentage: number };
  setNewProfessionalData: Dispatch<
    SetStateAction<{ name: string; commission_percentage: number }>
  >;
  handleCreateProfessional: (event: FormEvent) => Promise<void> | void;
  setEditingProfessional: (professional: Professional | null) => void;
  handleDeleteProfessional: (id: string) => Promise<void> | void;
  loading: boolean;
}
export interface ClientsListCardProps {
  clientsCount: number;
  filteredClients: Client[];
  searchClientQuery: string;
  setSearchClientQuery: (value: string) => void;
  showAddClientForm: boolean;
  setShowAddClientForm: (value: boolean) => void;
  newClientData: { name_complete: string; num_phone: string; email: string };
  setNewClientData: Dispatch<
    SetStateAction<{ name_complete: string; num_phone: string; email: string }>
  >;
  handleCreateClient: (event: FormEvent) => Promise<boolean> | boolean;
  setEditingClient: (client: Client | null) => void;
  onSelectClient: (client: Client) => void;
  handleDeleteClient: (clientId: string) => Promise<void> | void;
  loading: boolean;
}
export interface ServicesListCardProps {
  servicesCount: number;
  services: Service[];
  showAddServiceForm: boolean;
  setShowAddServiceForm: (value: boolean) => void;
  newServiceData: {
    name: string;
    price: string | number;
    duration: string | number;
  };
  setNewServiceData: Dispatch<
    SetStateAction<{
      name: string;
      price: string | number;
      duration: string | number;
    }>
  >;
  handleCreateService: (event: FormEvent) => Promise<boolean> | boolean;
  setEditingService: (service: Service | null) => void;
  handleDeleteService: (serviceId: string) => Promise<void> | void;
  loading: boolean;
}
export interface ManualMessageFormProps {
  clients: Client[];
  reminderClientId: string;
  setReminderClientId: (value: string) => void;
  selectedTemplate: string;
  setSelectedTemplate: (value: string) => void;
  manualMessage: { phone: string; text: string };
  setManualMessage: Dispatch<SetStateAction<{ phone: string; text: string }>>;
  applyMessageTemplate: (clientId: string, template: string) => void;
  onSubmit: (event: FormEvent) => Promise<void>;
  sendingMessage?: boolean;
}
