export interface Offer {
  id: string;
  title: string;
  category: string;
  year: number;
  capacityKg: number | null;
  liftHeightMm: number | null;
  voltageV: number | null;
  operatingHours: number | null;
  priceNetEuro: number | null;
  images: string[];
  detailUrl: string;
  specialEquipmentDescription: string | null;
}

export interface BrandConfig {
  companyName: string;
  logoPath: string;
  partnerLogoPath: string;
  phone: string;
  email: string;
  address: string;
  locations: string[];
  website: string;
  primaryColor: string;
  contactPerson: {
    name: string;
    phone: string;
    mobile: string;
    email: string;
  };
}
