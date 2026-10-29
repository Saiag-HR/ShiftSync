-- Create Enum for Roles & Shifts
CREATE TYPE user_role AS ENUM ('admin', 'employee');
CREATE TYPE shift_type AS ENUM ('morning', 'evening', 'night');

-- Profiles Table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role user_role DEFAULT 'employee',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employee Availability Table
CREATE TABLE shift_availabilities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  shift_type shift_type NOT NULL,
  is_available BOOLEAN DEFAULT true,
  UNIQUE(employee_id, shift_date, shift_type)
);

-- Final Shift Assignments Table
CREATE TABLE shift_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_date DATE NOT NULL,
  shift_type shift_type NOT NULL,
  employee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shift_date, shift_type)
);
