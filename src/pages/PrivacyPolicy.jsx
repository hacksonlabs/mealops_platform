import React from "react";

const PrivacyPolicy = () => {
  return (
    <main className="container mx-auto px-4 max-w-4xl py-8 text-gray-800">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-6">Last updated July 29, 2025</p>

      <section className="mb-6">
        <h2 className="text-2xl font-bold mb-2">I. Introduction</h2>
        <p>
          At MealOps, we connect individuals with the best meal programs and services available,
          enabling users to meet their dietary and nutritional needs with ease and convenience. This
          Privacy Policy describes how MealOps collects, uses, and shares information when you use
          our platform.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-bold mb-2">II. Information We Collect</h2>
        <ul className="list-disc list-inside space-y-2">
          <li><strong>Personal Information:</strong> Your name, email address, phone number, and other identifying information.</li>
          <li><strong>Order Information:</strong> Meal preferences, delivery locations, and saved restaurants.</li>
          <li><strong>Usage Data:</strong> Pages visited, interactions with features, and time spent on the platform.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-bold mb-2">III. How We Use Your Information</h2>
        <ul className="list-disc list-inside space-y-2">
          <li>To provide and improve our services.</li>
          <li>To communicate with you about orders, updates, and support.</li>
          <li>To personalize your user experience.</li>
          <li>To analyze usage trends and improve performance.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-bold mb-2">IV. Sharing Your Information</h2>
        <p>
          We do not sell your personal information. We may share your information with third-party vendors
          (like SMS/email providers or delivery partners) only as necessary to fulfill your order or
          improve your experience. All partners are vetted and required to meet strict confidentiality and security standards.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-bold mb-2">V. Data Retention</h2>
        <p>
          We retain your data only for as long as necessary to provide you services and comply with legal obligations.
          You can request deletion of your data at any time by contacting our support team.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-bold mb-2">VI. Your Rights</h2>
        <p>
          You have the right to:
        </p>
        <ul className="list-disc list-inside space-y-2">
          <li>Access the data we store about you</li>
          <li>Request corrections or deletions</li>
          <li>Opt out of marketing communications</li>
        </ul>
        <p className="mt-2">
          To exercise any of these rights, contact us at <a href="mailto:mealops.help@gmail.com" className="text-blue-600 underline">mealops.help@gmail.com</a>.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-bold mb-2">VII. Security</h2>
        <p>
          We use best-in-class security protocols to protect your information. However, no online
          system is 100% secure, so we recommend safeguarding your login information and using a strong password.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-bold mb-2">VIII. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. If we make significant changes, we will notify
          you via email or through the platform.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-2">IX. Contact Us</h2>
        <p>
          If you have questions or concerns about this policy, please contact us at:
          <br />
          <span className="block mt-2">MealOps, Inc.</span>
          <br />
          <a href="mailto:mealops.help@gmail.com" className="text-blue-600 underline">mealops.help@gmail.com</a>
        </p>
      </section>
    </main>
  );
};

export default PrivacyPolicy;
