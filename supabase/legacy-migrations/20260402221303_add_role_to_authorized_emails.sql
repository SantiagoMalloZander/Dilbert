-- Add role column to authorized_emails table
-- This fixes the critical issue where createCompanyWithOwner() and addCompanyUser()
-- were trying to write the 'role' field to a table that didn't have it.

-- Step 1: Add the column with a safe default
ALTER TABLE public.authorized_emails
ADD COLUMN role user_role NOT NULL DEFAULT 'vendor';

-- Step 2: Update any existing authorized_emails that have a corresponding user
-- to inherit the role from the users table
UPDATE public.authorized_emails ae
SET role = u.role
FROM public.users u
WHERE ae.email = u.email
  AND ae.company_id = u.company_id;

-- Step 3: Ensure the column is indexed for performance on lookups
CREATE INDEX IF NOT EXISTS idx_authorized_emails_role
ON public.authorized_emails(company_id, role);

-- Step 4: Unique constraint on (company_id, email) if not exists
-- (Email invitations should be unique per company)
ALTER TABLE public.authorized_emails
ADD CONSTRAINT uq_authorized_emails_company_email
UNIQUE(company_id, email);
