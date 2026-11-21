export type Category =
  | 'Furniture'
  | 'Appliances'
  | 'Bicycles'
  | 'Electronics'
  | 'Outdoors'
  | 'Dining'
  | 'Office'
  | 'Living room'
  | 'Kitchen'
  | 'New arrivals';

export type ProductMedia = {
  id: string;
  productId: string;
  url: string;
  type: string;
  position: number;
};

export type ProductVariant = {
  id: string;
  productId: string;
  sku: string;
  name?: string;
  priceCents: number;
  isPublished: boolean;
};

export type Product = {
  id: string;
  name: string;
  description?: string;
  category: Category;
  isPublished: boolean;
  variants: ProductVariant[];
  media: ProductMedia[];
};
