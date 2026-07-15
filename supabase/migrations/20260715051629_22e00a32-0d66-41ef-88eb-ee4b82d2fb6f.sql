
-- Allow caregivers to self-manage their own child without a therapist
ALTER TABLE public.patients ALTER COLUMN therapist_id DROP NOT NULL;

-- Caregivers can insert their own patients (self-managed)
CREATE POLICY "caregiver insert own patients"
ON public.patients FOR INSERT
TO authenticated
WITH CHECK (
  therapist_id IS NULL
  AND claimed_by_caregiver_id = auth.uid()
  AND has_role(auth.uid(), 'caregiver'::app_role)
);

-- Caregivers can update their own patients
CREATE POLICY "caregiver update own patients"
ON public.patients FOR UPDATE
TO authenticated
USING (claimed_by_caregiver_id = auth.uid())
WITH CHECK (claimed_by_caregiver_id = auth.uid());
