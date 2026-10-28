import React, { useEffect } from "react";

export const AccountPage: React.FC = () => {
  useEffect(() => {
    window.location.hash = "settings?s=profile";
  }, []);

  return null;
};

export default AccountPage;
