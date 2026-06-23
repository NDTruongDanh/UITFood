import { apiClient } from '@/lib/api-client';

export interface MenuCategory {
  id: string;
  restaurantId: string;
  name: string;
  displayOrder: number;
  createdAt: string;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  itemKind: 'food' | 'beverage' | 'mixed';
  status: 'available' | 'unavailable' | 'out_of_stock';
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type MenuItemStatusFilter = MenuItem['status'] | 'all' | 'visible';

export const menuApi = {
  getCategories: (restaurantId: string) =>
    apiClient
      .get<
        MenuCategory[]
      >('/api/menu-items/categories', { params: { restaurantId } })
      .then((r) => r.data),

  getItems: (
    restaurantId: string,
    params?: {
      categoryId?: string;
      status?: MenuItemStatusFilter;
      offset?: number;
      limit?: number;
    },
  ) =>
    apiClient
      .get<{
        data: MenuItem[];
        total: number;
      }>('/api/menu-items', { params: { restaurantId, ...params } })
      .then((r) => r.data),
};
