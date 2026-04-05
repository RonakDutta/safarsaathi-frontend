import { useEffect, useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext"; // Import Auth to auto-fill name
import toast from "react-hot-toast";
import axios from "../api/axios"; // Use the Axios instance we set up
import Bodyfooter from "./Bodyfooter";

function Body() {
  const { user, isAuthenticated } = useContext(AuthContext);

  const [name, setName] = useState("");
  const [pickup, setPickup] = useState("");
  const [phone, setPhone] = useState("");
  const [duration, setDuration] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Online");
  const [isLocating, setIsLocating] = useState(false);
  const [coordinates, setCoordinates] = useState(null);

  // Helper to inject Razorpay script into the page dynamically
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Auto-fill Name if Logged In
  useEffect(() => {
    if (isAuthenticated && user) {
      setName(user.full_name || user.name);
    }
  }, [isAuthenticated, user]);

  const handleGetLiveLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }
    setIsLocating(true);
    const loadingToast = toast.loading("Fetching your location...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCoordinates({ lat: latitude, lon: longitude });
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
          );
          const data = await response.json();
          if (data && data.display_name) {
            setPickup(data.display_name);
            toast.success("Location found!", { id: loadingToast });
          } else {
            toast.error("Could not find address.", { id: loadingToast });
          }
        } catch (error) {
          console.error("Reverse geocoding failed:", error);
          toast.error("Failed to fetch address.", { id: loadingToast });
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        toast.error("Location permission denied.", { id: loadingToast });
        setIsLocating(false);
      },
    );
  };

  const handleBooking = async () => {
    if (!name || !pickup || !phone || !duration) {
      toast.error("Please fill in all the booking details.");
      return;
    }

    if (!isAuthenticated) {
      toast.error("Please login to book a ride.");
      return;
    }

    const messageBody = {
      name,
      pickup,
      phone: "91" + phone,
      duration,
      paymentMethod,
      coordinates,
    };

    const loadingToast = toast.loading("Processing your booking...");

    try {
      // 1. Send data to backend
      const res = await axios.post("/api/book-ride", messageBody);

      if (res.data.requiresPayment) {
        // 2. Load Razorpay Script
        const resScript = await loadRazorpayScript();
        if (!resScript) {
          toast.error("Razorpay SDK failed to load. Are you online?", {
            id: loadingToast,
          });
          return;
        }

        // 3. Open Razorpay Checkout Modal
        const options = {
          key: res.data.key,
          amount: res.data.order.amount,
          currency: "INR",
          name: "SafarSaathi",
          description: `Ride Booking for ${duration} hours`,
          order_id: res.data.order.id,
          handler: async function (response) {
            // 4. Payment Successful -> Verify on Backend
            toast.loading("Verifying payment securely...", {
              id: loadingToast,
            });
            try {
              await axios.post("/api/book-ride/verify-payment", {
                ...response,
                bookingId: res.data.bookingId,
              });
              toast.success("Payment Successful! Booking Confirmed. 🚖", {
                id: loadingToast,
              });

              setPickup("");
              setDuration("");
            } catch (err) {
              toast.error("Payment verification failed.", { id: loadingToast });
            }
          },
          prefill: {
            name: name,
            contact: phone,
          },
          theme: {
            color: "#ffc107",
          },
          modal: {
            ondismiss: async function () {
              try {
                await axios.post("/api/book-ride/cancel-booking", {
                  bookingId: res.data.bookingId,
                });
                toast.error("Payment cancelled. Booking was not completed.");
              } catch (err) {
                console.error("Failed to clear abandoned booking");
              }
            },
          },
        };

        const paymentObject = new window.Razorpay(options);

        paymentObject.on("payment.failed", function (response) {
          toast.error("Payment failed or cancelled.", { id: loadingToast });
        });

        toast.dismiss(loadingToast);
        paymentObject.open();
      } else {
        toast.success("Booking Confirmed! Pay with cash after the ride.", {
          id: loadingToast,
        });
        setPickup("");
        setDuration("");
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || "Booking Failed", {
        id: loadingToast,
      });
    }
  };

  const handlePhoneChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhone(val);
  };

  return (
    <div className="bg-zinc-900">
      <main>
        {/* Hero Section */}
        <section className="relative h-max flex items-center justify-center text-center px-8 bg-[url('https://images.unsplash.com/photo-1542435503-956c469947f6?q=80&w=2070&auto=format&fit=crop')] bg-no-repeat bg-center bg-cover">
          <div className="absolute top-0 left-0 w-full h-full bg-black/75"></div>

          <div className="relative z-10 max-w-250 py-24 mx-auto px-8">
            <h1 className="mt-12 text-[3.5rem] font-bold mb-4 text-white">
              Book Your Ride, Anytime, Anywhere.
            </h1>
            <p className="text-xl mb-10 text-[#e0e0e0]">
              Hire a professional driver for a specific duration.
            </p>

            {/* Booking Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#1e1e1e] p-8 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] w-full max-w-225 mt-20 mx-auto">
              {/* Name Input */}
              <div className="relative">
                <i className="fas fa-user absolute left-4 top-1/2 -translate-y-1/2 text-[#888] transition-colors duration-300"></i>
                <input
                  type="text"
                  placeholder="Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isAuthenticated} // Disable if logged in (optional)
                  className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg text-[#e0e0e0] text-base px-11 py-4 transition-all duration-300 focus:outline-none focus:border-[#ffc107] focus:shadow-[0_0_0_3px_rgba(255,193,7,0.2)] placeholder:text-[#888]"
                />
              </div>

              {/* Pickup Location Input */}
              <div className="relative">
                <i className="fas fa-map-marker-alt absolute left-4 top-1/2 -translate-y-1/2 text-[#888] transition-colors duration-300"></i>
                <input
                  type="text"
                  placeholder="Enter Pickup Location"
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg text-[#e0e0e0] text-base pr-[2.7rem] pl-10 py-4 transition-all duration-300 focus:outline-none focus:border-[#ffc107] focus:shadow-[0_0_0_3px_rgba(255,193,7,0.2)] placeholder:text-[#888]"
                />
                <button
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-transparent border-none text-[#ffc107] text-xl cursor-pointer p-1 transition-colors duration-300 hover:text-white disabled:cursor-not-allowed disabled:text-[#888]"
                  onClick={handleGetLiveLocation}
                  disabled={isLocating}
                >
                  {isLocating ? (
                    <i className="fas fa-spinner fa-spin"></i>
                  ) : (
                    <i className="fas fa-crosshairs"></i>
                  )}
                </button>
              </div>

              {/* Phone Input */}
              <div className="relative">
                <i className="fab fa-whatsapp absolute left-4 top-1/2 -translate-y-1/2 text-[#888] text-xl transition-colors duration-300"></i>
                <input
                  type="tel"
                  placeholder="WhatsApp Number"
                  value={phone}
                  onChange={handlePhoneChange}
                  maxLength="10"
                  className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg text-[#e0e0e0] text-base px-11 py-4 transition-all duration-300 focus:outline-none focus:border-[#ffc107] focus:shadow-[0_0_0_3px_rgba(255,193,7,0.2)] placeholder:text-[#888]"
                />
              </div>

              {/* Duration Input */}
              <div className="relative">
                <i className="fas fa-clock absolute left-4 top-1/2 -translate-y-1/2 text-[#888] transition-colors duration-300"></i>
                <input
                  type="number"
                  placeholder="Duration (Max 24 hours)"
                  min="1"
                  max="24"
                  value={duration}
                  onChange={(e) => {
                    if (e.target.value <= 24 && e.target.value >= 0) {
                      setDuration(e.target.value);
                    } else {
                      setDuration(duration);
                    }
                  }}
                  className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg text-[#e0e0e0] text-base px-11 py-4 transition-all duration-300 focus:outline-none focus:border-[#ffc107] focus:shadow-[0_0_0_3px_rgba(255,193,7,0.2)] placeholder:text-[#888]"
                />
              </div>

              {/* Payment Options */}
              <div className="col-span-1 md:col-span-2 flex gap-6 items-center justify-center py-2 text-[#e0e0e0]">
                <label className="flex items-center cursor-pointer text-sm hover:text-white transition">
                  <input
                    type="radio"
                    name="payment"
                    value="Online"
                    checked={paymentMethod === "Online"}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mr-2 accent-[#ffc107] w-4 h-4 cursor-pointer"
                  />
                  Online Payment
                </label>
                <label className="flex items-center cursor-pointer text-sm hover:text-white transition">
                  <input
                    type="radio"
                    name="payment"
                    value="Cash"
                    checked={paymentMethod === "Cash"}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mr-2 accent-[#ffc107] w-4 h-4 cursor-pointer"
                  />
                  Pay with Cash
                </label>
              </div>

              {/* Submit Button */}
              <button
                className="col-span-1 md:col-span-2 justify-self-center w-auto min-w-62.5 px-8 py-[1.1rem] border-none rounded-full font-medium cursor-pointer transition-all duration-300 text-lg bg-[#ffc107] text-black hover:bg-[#ffca2c] hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(255,193,7,0.4)]"
                onClick={handleBooking}
              >
                Confirm Booking
              </button>
            </div>
          </div>
        </section>
        <Bodyfooter />
      </main>

      <style>
        {`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease;
        }
        .animate-slideUp {
          animation: slideUp 0.4s ease;
        }
      `}
      </style>
      <style>
        {`
        /* Hide Number Input Arrows */
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield; /* Firefox */
        }

        /* Your existing animations... */
        @keyframes fadeIn { ... }
        `}
      </style>
    </div>
  );
}

export default Body;
