import cv2
import numpy as np
from PIL import Image
import io
import os

def draw_leaf_bounding_box(image_bytes: bytes) -> bytes:
    try:
        # Convert bytes to numpy array for cv2
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return image_bytes

        # Convert to HSV
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        
        # Define range for green color (same as in check_leaf_presence: h: 25-100, s>35, v>30)
        # OpenCV HSV range: H is 0-179, S is 0-255, V is 0-255
        # The PIL check was: H: 25-100 (in 0-255 scale). OpenCV H is 0-179.
        # Wait, PIL H is 0-255? Actually, in PIL H is 0-255, S is 0-255, V is 0-255.
        # So PIL 25-100 out of 255 is roughly 17-70 out of 179 in OpenCV.
        # Let's use a standard green range for OpenCV:
        lower_green = np.array([25, 40, 40])
        upper_green = np.array([90, 255, 255])
        
        mask = cv2.inRange(hsv, lower_green, upper_green)
        
        # Find contours
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if contours:
            # Find the largest contour
            largest_contour = max(contours, key=cv2.contourArea)
            
            # Only draw if the contour is reasonably large
            if cv2.contourArea(largest_contour) > 500:
                x, y, w, h = cv2.boundingRect(largest_contour)
                # Draw a green rectangle with thickness 3
                cv2.rectangle(img, (x, y), (x+w, y+h), (0, 255, 0), 4)
                
                # Add a label above the bounding box
                cv2.putText(img, "Daun Terdeteksi", (x, max(30, y-10)), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)
        
        # Encode back to bytes
        _, buffer = cv2.imencode('.jpg', img)
        return buffer.tobytes()
        
    except Exception as e:
        print(f"Error drawing bounding box: {e}")
        return image_bytes

# Test with a dummy image if needed
if __name__ == "__main__":
    print("Scratch test ready.")
