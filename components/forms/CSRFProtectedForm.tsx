/**
 * CSRF Protected Form Component
 *
 * A wrapper component that automatically adds CSRF protection to forms.
 * This component demonstrates how to integrate CSRF tokens into form submissions.
 */

"use client";

import type { FormEvent, ReactNode } from "react";
import { useId } from "react";
import { useCSRFForm } from "../../lib/hooks/useCSRF";

interface CSRFProtectedFormProps {
  children: ReactNode;
  action: string;
  method?: "POST" | "PUT" | "DELETE" | "PATCH";
  onSubmit?: (formData: FormData) => Promise<void> | void;
  onError?: (error: Error) => void;
  className?: string;
  encType?: string;
}

/**
 * Form component with automatic CSRF protection
 */
export function CSRFProtectedForm({
  children,
  action,
  method = "POST",
  onSubmit,
  onError,
  className,
  encType,
}: CSRFProtectedFormProps) {
  const { token, submitForm, addTokenToFormData } = useCSRFForm();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    // Add CSRF token to form data
    addTokenToFormData(formData);

    try {
      if (onSubmit) {
        // Use custom submit handler
        await onSubmit(formData);
      } else {
        // Use default form submission with CSRF protection
        const response = await submitForm(action, formData);

        if (!response.ok) {
          throw new Error(`Form submission failed: ${response.status}`);
        }

        // Handle successful submission
        console.log("Form submitted successfully");
      }
    } catch (error) {
      console.error("Form submission error:", error);

      // Notify user of the error
      if (onError && error instanceof Error) {
        onError(error);
      } else {
        // Fallback: show alert if no error handler provided
        alert("An error occurred while submitting the form. Please try again.");
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      method={method}
      action={action}
      className={className}
      encType={encType}
    >
      {/* Hidden CSRF token field for non-JS fallback */}
      {token && <input type="hidden" name="csrf_token" value={token} />}

      {children}
    </form>
  );
}

/**
 * Example usage component showing how to use CSRF protected forms
 */
export function ExampleCSRFForm() {
  // Generate unique IDs for form elements
  const nameId = useId();
  const emailId = useId();
  const messageId = useId();

  const handleCustomSubmit = async (formData: FormData) => {
    // Custom form submission logic
    // Filter out CSRF token for security when logging
    const data = Object.fromEntries(formData.entries());
    // biome-ignore lint/correctness/noUnusedVariables: csrf_token is intentionally extracted and discarded for security
    const { csrf_token, ...safeData } = data;
    console.log("Form data (excluding CSRF token):", safeData);

    // You can process the form data here before submission
    // The CSRF token is automatically included in formData
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">
        CSRF Protected Form Example
      </h2>

      <CSRFProtectedForm
        action="/api/example-endpoint"
        onSubmit={handleCustomSubmit}
        className="space-y-4"
      >
        <div>
          <label
            htmlFor={nameId}
            className="block text-sm font-medium text-gray-700"
          >
            Name
          </label>
          <input
            type="text"
            id={nameId}
            name="name"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label
            htmlFor={emailId}
            className="block text-sm font-medium text-gray-700"
          >
            Email
          </label>
          <input
            type="email"
            id={emailId}
            name="email"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label
            htmlFor={messageId}
            className="block text-sm font-medium text-gray-700"
          >
            Message
          </label>
          <textarea
            id={messageId}
            name="message"
            rows={4}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <button
          type="submit"
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Submit
        </button>
      </CSRFProtectedForm>
    </div>
  );
}
