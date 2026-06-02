export type Theme = {
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  text_dim: string;
  font_display: string;
  font_body: string;
  logo_key: string;
};

export type Outlet = {
  id: string;
  slug: string;
  name: string;
  tagline?: string;
  theme: Theme;
  features: { waiter_call: boolean; remarks: boolean; service_charge: boolean; kds: boolean };
  currency: string;
};

export type Table = { id: string; number: number; capacity: number; zone: string; qr_uid: string };

export type MenuCategory = { id: string; name: string; sort: number };

export type MenuItem = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  serving: string | null;
  emoji: string | null;
  image_url: string | null;
  prep_time: number;
  is_veg: boolean;
  available: boolean;
};

export type OrderItem = {
  id: string;
  name_snapshot: string;
  price_at_order: number;
  qty: number;
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
  remark: string | null;
  added_by: 'customer' | 'waiter';
  created_at: string;
};

export type ActiveOrder = {
  id: string;
  bill_no: string | null;
  status: string;
  opened_at: string;
  items: OrderItem[];
} | null;

export type CartLine = { item: MenuItem; qty: number; remark: string };
