import { ObjectId } from "mongodb";

export interface CategoryDocument {
  _id: ObjectId;
  name: string;
  slug: string;
  parent_id?: ObjectId | null;
  image_url?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface CategoryNode extends CategoryResponse {
  children: CategoryNode[];
}

export interface CategoryResponse {
  id: string;
  name: string;
  slug: string;
  parent_id?: string | null;
  image_url?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface CreateCategoryDTO {
  name: string;
  parent_id?: string | null;
  image_url?: string;
  sort_order?: number;
}

export interface UpdateCategoryDTO extends Partial<CreateCategoryDTO> {
  is_active?: boolean;
}
