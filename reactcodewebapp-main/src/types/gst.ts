export type GSTDetails = {
  gstin: string;
  legal_name: string;
  trade_name: string;
  registration_date: string;
  constitution_of_business: string;
  taxpayer_type: string;
  gstin_status: string;
  last_update_date: string;
  center_jurisdiction: string;
  state_jurisdiction: string;
  principal_place_of_business: {
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
  additional_places_of_business?: Array<{
    address: string;
    city: string;
    state: string;
    pincode: string;
  }>;
  nature_of_business_activities: string[];
  date_of_cancellation?: string;
  filing_status?: Array<{
    return_type: string;
    tax_period: string;
    date_of_filing: string;
    status: string;
  }>;
};

export type GSTVerificationResponse = {
  success: boolean;
  data?: GSTDetails;
  error?: string;
  message?: string;
};
