export type ContactRole =
  | "Manufacturing Manager"
  | "VP Manufacturing"
  | "Director of Manufacturing"
  | "Engineering Manager"
  | "CNC Programmer"
  | "CNC Machinist"
  | "Operations Manager"
  | "Owner"
  | "President"
  | "CEO";

export interface Contact {
  name: string;
  title: ContactRole | string;
  email?: string;
  linkedinUrl?: string;
  phone?: string;
}
