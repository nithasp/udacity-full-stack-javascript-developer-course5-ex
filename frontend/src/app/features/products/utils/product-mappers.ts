import { Product } from '../models/product';

export interface BackendProduct {
  id: number;
  name: string;
  category?: string;
  price: number;
  image?: string;
  description?: string;
  previewImg?: string[];
  types?: Product['types'];
  reviews?: Product['reviews'];
  overallRating?: number;
  stock?: number;
  isActive?: boolean;
  shopId?: string;
  shopName?: string;
}

export function mapBackendProduct(p: BackendProduct): Product {
  return {
    _id: String(p.id),
    name: p.name,
    category: p.category ?? '',
    price: p.price,
    image: p.image ?? '',
    description: p.description ?? '',
    previewImg: p.previewImg ?? [],
    types: p.types ?? [],
    reviews: p.reviews ?? [],
    overallRating: p.overallRating ?? 0,
    stock: p.stock,
    isActive: p.isActive,
    shopId: p.shopId,
    shopName: p.shopName,
  };
}
