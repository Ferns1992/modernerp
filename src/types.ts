export interface Category {
  id: number;
  name: string;
}

export interface Item {
  id: number;
  name: string;
  price: number;
  cost_price: number;
  category_id: number | null;
  category_name?: string;
  sku: string;
  stock: number;
  image_url?: string;
  low_stock_threshold?: number;
}

export interface CartItem extends Item {
  quantity: number;
}

export interface Branch {
  id: number;
  name: string;
  address?: string;
  contact?: string;
}

export interface Sale {
  id: number;
  subtotal: number;
  tax: number;
  total: number;
  discount: number;
  timestamp: string;
  payment_method: string;
  status: 'completed' | 'refunded' | 'voided' | 'pending';
  preparation_status?: 'pending' | 'preparing' | 'ready' | 'delivered';
  status_reason?: string;
  customer_id?: number | null;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  branch_id?: number | null;
  branch_name?: string;
  completed_by?: string;
  completed_at_branch_id?: number | null;
  completed_at_branch_name?: string;
}

export interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  created_at: string;
}

export interface PaymentMethod {
  id: number;
  name: string;
  is_active: number;
}

export interface DayEndReport {
  summary: {
    transaction_count: number;
    total_sales: number;
    total_revenue: number;
    total_tax: number;
    total_discount: number;
    total_refunds: number;
    total_voids: number;
    payment_method: string;
  }[];
  items: {
    name: string;
    total_quantity: number;
    total_revenue: number;
    total_cogs: number;
    total_profit: number;
  }[];
  categories: {
    name: string;
    total_revenue: number;
    total_cogs: number;
    total_profit: number;
  }[];
}

export interface InventoryReportData {
  items: (Item & { 
    valuation: number; 
    potential_profit: number;
    status: 'normal' | 'low' | 'out';
  })[];
  summary: {
    total_items: number;
    total_stock: number;
    total_valuation: number;
    total_potential_profit: number;
    low_stock_count: number;
    out_of_stock_count: number;
  };
}
