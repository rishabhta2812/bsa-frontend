import os
import json

# Define paths to the directories
# features_dir = r"C:\Users\50093\Desktop\bsa_updated\frontend\assets\features"
# ews_reports_dir = r"C:\Users\50093\Desktop\bsa_updated\frontend\assets\ews_reports"
# nach_reports_dir = r"C:\Users\50093\Desktop\bsa_updated\frontend\assets\nach_reports"
customer_dir = r"C:\Users\50093\Desktop\bsa_updated\frontend\assets\customer_data"
output_file = r"C:\Users\50093\Desktop\bsa_updated\frontend\assets\mobile_numbers1.json"

# Function to extract mobile numbers from file names in a directory
def get_mobile_numbers(directory, pattern):
    mobile_numbers = set()
    for file_name in os.listdir(directory):
        # Match files with the expected pattern (e.g., 8072320428_Report.json, 8072320428_ews_report.json)
        if pattern in file_name:
            # Extract the mobile number (first part before the underscore)
            mobile = file_name.split('_')[0]
            # Ensure it's a 10-digit number
            if mobile.isdigit() and len(mobile) == 10:
                mobile_numbers.add(mobile)
    return mobile_numbers

# Get mobile numbers from each directory
# features_mobiles = get_mobile_numbers(features_dir, '_Report.json')
# ews_mobiles = get_mobile_numbers(ews_reports_dir, '_ews_report.json')
# nach_mobiles = get_mobile_numbers(nach_reports_dir, '_nach_report.json')
customer_mobiles = get_mobile_numbers(customer_dir, '_cleaned.json')

# Find the intersection of mobile numbers present in all three directories
# common_mobiles = features_mobiles.intersection(ews_mobiles, nach_mobiles)

# Convert to a sorted list
mobile_numbers_list = sorted(list(customer_mobiles))

# Create the JSON structure
mobile_numbers_json = {
    "mobileNumbers": mobile_numbers_list
}

# Save to mobile_numbers.json
with open(output_file, 'w') as f:
    json.dump(mobile_numbers_json, f, indent=2)

print(f"Generated mobile_numbers.json with {len(mobile_numbers_list)} mobile numbers.")