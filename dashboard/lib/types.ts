export type Outlet = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  cgst: number;
  sgst: number;
  service_charge: number;
  currency: string;
  theme: Record<string, string>;
  features: Record<string, boolean>;
};

export type Table = {
  id: string; outlet_id: string; number: number;
  capacity: number; zone: string; qr_uid: string;
};

export type MenuCategory = { id: string; outlet_id: string; name: string; sort: number };

export type MenuItem = {
  id: string; outlet_id: string; category_id: string | null;
  name: string; description: string | null; price: number;
  serving: string | null; emoji: string | null; prep_time: number;
  is_veg: boolean; available: boolean; sort: number;
};

export type OrderRow = {
  id: string; bill_no: string | null; outlet_id: string; table_id: string;
  customer_id: string | null; status: 'open' | 'closed' | 'cancelled';
  opened_at: string; closed_at: string | null;
  payment_methods: string | null;
};

export type OrderItemRow = {
  id: string; order_id: string; menu_item_id: string | null;
  name_snapshot: string; price_at_order: number; qty: number;
  status: 'pending' | 'preparing' | 'delivered' | 'cancelled';
  remark: string | null; added_by: 'customer' | 'waiter'; created_at: string;
};

export type Customer = { id: string; name: string; phone: string };

export type Staff = {
  id: string; outlet_id: string; auth_user_id: string | null;
  name: string; role: 'admin' | 'manager' | 'waiter' | 'chef';
  email: string | null; phone: string | null; active: boolean;
};
