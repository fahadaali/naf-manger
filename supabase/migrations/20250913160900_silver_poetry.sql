/*
  # Fix infinite recursion in users table RLS policies

  1. Problem
    - The current RLS policies on the users table are causing infinite recursion
    - The "Admins can read all users" policy queries the users table to check if a user is admin
    - This creates a circular dependency when Supabase tries to evaluate the policy

  2. Solution
    - Drop the problematic policies that cause recursion
    - Create simpler policies that don't reference the users table within the policy
    - Use auth.uid() directly without additional user lookups where possible

  3. Security
    - Maintain security by allowing users to read/update their own data
    - Allow service role to manage all users (for admin operations)
    - Remove the recursive admin check policies
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can manage all users" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

-- Create new non-recursive policies
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow service role to manage all users (for admin operations through server-side code)
CREATE POLICY "Service role can manage all users"
  ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);