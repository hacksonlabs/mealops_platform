import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/custom/Button';
import ShareCartModal from './ShareCartModal';

const ShareCartButton = ({
  cartId,
  restaurant,      // pass-through
  providerType,    // pass-through
  fulfillment,     // pass-through
  onCreated,       // pass-through
  cartTitle,
  mealType,
  variant = "outline",
  className = ""
}) => {
  const [showShareModal, setShowShareModal] = useState(false);

  return (
    <>
      <Button
        onClick={() => setShowShareModal(true)}
        variant={variant}
        className={`flex items-center space-x-2 ${className}`}
      >
        <Icon name="Share" size={16} />
        <span>Share Cart</span>
      </Button>

      {showShareModal && (
        <ShareCartModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          cartId={cartId}
          restaurant={restaurant}
          providerType={providerType}
          fulfillment={fulfillment}
          onCreated={onCreated}
          cartTitle={cartTitle}
          mealType={mealType}
        />
      )}
    </>
  );
};

export default ShareCartButton;